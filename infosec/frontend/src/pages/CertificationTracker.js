import React, { useState, useEffect, useCallback, useContext } from 'react';
import { api, AuthContext } from '../App';

/* ── Constants ─────────────────────────────────────────────────── */
const FRAMEWORKS = [
  { id: 'PCIDSS',   label: 'PCI DSS v4.0',    color: '#ef4444', desc: 'Payment Card Industry Data Security Standard' },
  { id: 'ISO27001', label: 'ISO 27001:2022',   color: '#3b82f6', desc: 'Information Security Management System' },
  { id: 'ISO42001', label: 'ISO 42001:2023',   color: '#8b5cf6', desc: 'AI Management System' },
  { id: 'NISTCSF',  label: 'NIST CSF 2.0',    color: '#10b981', desc: 'Cybersecurity Framework' },
  { id: 'SOC2',     label: 'SOC 2 Type II',    color: '#f59e0b', desc: 'Service Organization Control 2' },
  { id: 'HIPAA',    label: 'HIPAA',            color: '#06b6d4', desc: 'Health Insurance Portability and Accountability Act' },
  { id: 'GDPR',     label: 'GDPR',             color: '#6366f1', desc: 'General Data Protection Regulation' },
  { id: 'CUSTOM',   label: 'Custom',           color: '#6b7280', desc: 'Custom framework' },
];

const PHASES = [
  { id: 'planning',     label: 'Planning',     color: '#6b7280' },
  { id: 'gap_analysis', label: 'Gap Analysis', color: '#f59e0b' },
  { id: 'remediation',  label: 'Remediation',  color: '#f97316' },
  { id: 'pre_audit',    label: 'Pre-Audit',    color: '#3b82f6' },
  { id: 'audit',        label: 'Audit',        color: '#8b5cf6' },
  { id: 'certified',    label: 'Certified',    color: '#10b981' },
  { id: 'surveillance', label: 'Surveillance', color: '#06b6d4' },
  { id: 'renewal',      label: 'Renewal',      color: '#6366f1' },
];

const TL_TYPES = [
  { id: 'milestone',    label: 'Milestone',      icon: '⭐', color: '#3b82f6' },
  { id: 'audit',        label: 'Audit',          icon: '📋', color: '#8b5cf6' },
  { id: 'finding',      label: 'Finding',        icon: '⚠️',  color: '#ef4444' },
  { id: 'action',       label: 'Action',         icon: '⚙️',  color: '#f97316' },
  { id: 'approval',     label: 'Approval',       icon: '✅', color: '#10b981' },
  { id: 'certification',label: 'Certification',  icon: '🏆', color: '#f59e0b' },
  { id: 'note',         label: 'Note',           icon: '📝', color: '#6b7280' },
];

const STEP_STATUSES = [
  { id: 'pending',     label: 'Pending',     color: '#6b7280' },
  { id: 'in_progress', label: 'In Progress', color: '#3b82f6' },
  { id: 'completed',   label: 'Completed',   color: '#10b981' },
  { id: 'blocked',     label: 'Blocked',     color: '#ef4444' },
  { id: 'skipped',     label: 'Skipped',     color: '#9ca3af' },
];

const REQ_STATUSES = [
  { id: 'compliant',       label: 'Compliant',       color: '#10b981' },
  { id: 'in_progress',     label: 'In Progress',     color: '#3b82f6' },
  { id: 'non_compliant',   label: 'Non-Compliant',   color: '#ef4444' },
  { id: 'not_applicable',  label: 'N/A',             color: '#9ca3af' },
  { id: 'not_assessed',    label: 'Not Assessed',    color: '#6b7280' },
];

/* ── Helpers ───────────────────────────────────────────────────── */
const fw   = id => FRAMEWORKS.find(f => f.id === id) || { label: id, color: '#6b7280' };
const ph   = id => PHASES.find(p => p.id === id)     || { label: id, color: '#6b7280' };
const rs   = id => REQ_STATUSES.find(s => s.id === id)|| { label: id, color: '#6b7280' };
const tl   = id => TL_TYPES.find(t => t.id === id)   || { icon: '●',  color: '#6b7280' };
const fmtD = d => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const fmtDT= d => d ? new Date(d).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
const isOverdue = d => d && new Date(d) < new Date();

const badge = (color, text) => (
  <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:10,
                 fontSize:11, fontWeight:600, background:`${color}20`, color, whiteSpace:'nowrap' }}>
    {text}
  </span>
);

const inp  = { width:'100%', background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:6, padding:'8px 10px', color:'var(--text1)', fontSize:13, boxSizing:'border-box' };
const sel  = { background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:6, padding:'8px 10px', color:'var(--text1)', fontSize:13, width:'100%', boxSizing:'border-box' };
const btnS = (v='default') => {
  const vs = {
    default: { background:'var(--surface3)', border:'1px solid var(--border2)', color:'var(--text1)' },
    primary: { background:'var(--accent)', border:'none', color:'#fff' },
    danger:  { background:'#ef444422', border:'1px solid #ef4444', color:'#ef4444' },
    sm:      { background:'var(--surface3)', border:'1px solid var(--border2)', color:'var(--text1)', padding:'4px 10px', fontSize:12 },
  };
  return { ...vs[v], borderRadius:6, padding:'7px 14px', cursor:'pointer', fontSize:13, fontWeight:500 };
};

/* ── CertificationTracker ─────────────────────────────────────── */
export default function CertificationTracker() {
  const { user } = useContext(AuthContext);
  const canEdit  = ['admin','analyst'].includes(user?.role);

  const [tab,   setTab]   = useState('overview');
  const [certs, setCerts] = useState([]);
  const [orgs,  setOrgs]  = useState([]);
  const [selCert, setSelCert] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.get('/certifications'), api.get('/certifications/organizations')])
      .then(([c, o]) => { setCerts(c.data); setOrgs(o.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const TABS = [
    { id: 'overview',      label: 'Overview',      icon: '📊' },
    { id: 'requirements',  label: 'Requirements',  icon: '📋' },
    { id: 'timeline',      label: 'Timeline',      icon: '📅' },
    { id: 'workflows',     label: 'Workflows',     icon: '⚙️' },
  ];

  const totalCompliant = certs.reduce((a, c) => a + (c.completion_pct || 0), 0);
  const avgCompletion  = certs.length ? Math.round(totalCompliant / certs.length) : 0;
  const overdue        = certs.filter(c => isOverdue(c.target_date) && c.status === 'active').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Certification Tracker</div>
          <div className="page-subtitle">Multi-framework certification management across organizations</div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="tabs" style={{ marginBottom:20 }}>
        {TABS.map(t => (
          <button key={t.id} className={`tab-btn ${tab===t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? <div className="empty-state"><div className="spinner" /></div> : (
        <>
          {tab === 'overview'     && <OverviewTab certs={certs} orgs={orgs} avgCompletion={avgCompletion}
                                                  overdue={overdue} canEdit={canEdit} onRefresh={load} />}
          {tab === 'requirements' && <RequirementsTab certs={certs} selCert={selCert} setSelCert={setSelCert}
                                                       canEdit={canEdit} onRefresh={load} />}
          {tab === 'timeline'     && <TimelineTab certs={certs} selCert={selCert} setSelCert={setSelCert}
                                                   canEdit={canEdit} onRefresh={load} />}
          {tab === 'workflows'    && <WorkflowsTab certs={certs} selCert={selCert} setSelCert={setSelCert}
                                                    canEdit={canEdit} onRefresh={load} />}
        </>
      )}
    </div>
  );
}

/* ── Overview Tab ─────────────────────────────────────────────── */
function OverviewTab({ certs, orgs, avgCompletion, overdue, canEdit, onRefresh }) {
  const [showNewCert, setShowNewCert] = useState(false);
  const [showNewOrg,  setShowNewOrg]  = useState(false);
  const [filterFw,    setFilterFw]    = useState('');
  const [filterStatus,setFilterStatus]= useState('');

  const visible = certs.filter(c =>
    (!filterFw     || c.framework === filterFw) &&
    (!filterStatus || c.status    === filterStatus)
  );

  const byOrg = {};
  visible.forEach(c => {
    const key = c.org_name || 'No Organization';
    if (!byOrg[key]) byOrg[key] = [];
    byOrg[key].push(c);
  });

  return (
    <div>
      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
        {[
          { label:'Total Certifications', value: certs.length,   icon:'🏆', color:'#3b82f6' },
          { label:'Organizations',        value: orgs.length,    icon:'🏢', color:'#8b5cf6' },
          { label:'Avg Completion',       value:`${avgCompletion}%`, icon:'📈', color:'#10b981' },
          { label:'Overdue',              value: overdue,        icon:'⏰', color: overdue ? '#ef4444' : '#6b7280' },
        ].map(s => (
          <div key={s.label} style={{ background:'var(--surface2)', border:'1px solid var(--border1)',
               borderRadius:12, padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ fontSize:28 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
        <select style={{ ...sel, width:'auto', minWidth:140 }} value={filterFw} onChange={e => setFilterFw(e.target.value)}>
          <option value="">All Frameworks</option>
          {FRAMEWORKS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <select style={{ ...sel, width:'auto', minWidth:120 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {['active','paused','completed','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ flex:1 }} />
        {canEdit && (
          <>
            <button style={btnS('default')} onClick={() => setShowNewOrg(true)}>+ Organization</button>
            <button style={btnS('primary')} onClick={() => setShowNewCert(true)}>+ Certification</button>
          </>
        )}
      </div>

      {/* Certification cards grouped by org */}
      {Object.keys(byOrg).length === 0 ? (
        <div className="empty-state"><p>No certifications found. Add one to get started.</p></div>
      ) : (
        Object.entries(byOrg).map(([orgName, orgCerts]) => (
          <div key={orgName} style={{ marginBottom:28 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text2)', textTransform:'uppercase',
                          letterSpacing:'0.07em', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
              🏢 {orgName}
              <span style={{ fontSize:11, fontWeight:400, color:'var(--text3)' }}>({orgCerts.length} certification{orgCerts.length!==1?'s':''})</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px,1fr))', gap:14 }}>
              {orgCerts.map(c => <CertCard key={c.id} cert={c} orgs={orgs} onRefresh={onRefresh} canEdit={canEdit} />)}
            </div>
          </div>
        ))
      )}

      {showNewCert && <CertModal orgs={orgs} onClose={() => setShowNewCert(false)} onSave={onRefresh} />}
      {showNewOrg  && <OrgModal  onClose={() => setShowNewOrg(false)}  onSave={onRefresh} />}
    </div>
  );
}

function CertCard({ cert, orgs, onRefresh, canEdit }) {
  const f = fw(cert.framework);
  const p = ph(cert.phase);
  const [showEdit, setShowEdit] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${cert.name}"?`)) return;
    await api.delete(`/certifications/${cert.id}`).catch(console.error);
    onRefresh();
  };

  const expiryWarning = cert.expiry_date && (() => {
    const days = Math.ceil((new Date(cert.expiry_date) - new Date()) / 86400000);
    return days < 90 ? days : null;
  })();

  return (
    <div style={{ background:'var(--surface2)', border:`1px solid var(--border1)`, borderRadius:12,
                  borderTop:`3px solid ${f.color}`, padding:18, display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:f.color, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>
            {f.label}
          </div>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--text1)', lineHeight:1.3 }}>{cert.name}</div>
          {cert.scope && <div style={{ fontSize:11, color:'var(--text3)', marginTop:3 }}>{cert.scope}</div>}
        </div>
        <div style={{ display:'flex', gap:4 }}>
          {badge(cert.status==='active'?'#10b981':cert.status==='completed'?'#3b82f6':'#6b7280', cert.status)}
        </div>
      </div>

      {/* Phase progress bar */}
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
          {badge(p.color, p.label)}
          <span style={{ fontSize:13, fontWeight:700, color:f.color }}>{cert.completion_pct}%</span>
        </div>
        <div style={{ height:6, background:'var(--surface3)', borderRadius:3, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${cert.completion_pct}%`, background:f.color, borderRadius:3, transition:'width 0.3s' }} />
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:12 }}>
        {cert.owner && <div><span style={{ color:'var(--text3)' }}>Owner: </span>{cert.owner}</div>}
        {cert.auditor && <div><span style={{ color:'var(--text3)' }}>Auditor: </span>{cert.auditor}</div>}
        {cert.target_date && (
          <div style={{ color: isOverdue(cert.target_date) && cert.phase !== 'certified' ? '#ef4444' : 'var(--text2)' }}>
            <span style={{ color:'var(--text3)' }}>Target: </span>{fmtD(cert.target_date)}
            {isOverdue(cert.target_date) && cert.phase !== 'certified' && ' ⚠️'}
          </div>
        )}
        {cert.certified_date && <div style={{ color:'#10b981' }}><span style={{ color:'var(--text3)' }}>Certified: </span>{fmtD(cert.certified_date)}</div>}
        {cert.expiry_date && (
          <div style={{ color: expiryWarning !== null ? (expiryWarning < 30 ? '#ef4444' : '#f59e0b') : 'var(--text2)' }}>
            <span style={{ color:'var(--text3)' }}>Expires: </span>{fmtD(cert.expiry_date)}
            {expiryWarning !== null && ` (${expiryWarning}d)`}
          </div>
        )}
      </div>

      {canEdit && (
        <div style={{ display:'flex', gap:6, marginTop:4 }}>
          <button style={{ ...btnS('sm'), flex:1 }} onClick={() => setShowEdit(true)}>Edit</button>
          <button style={{ ...btnS('danger'), padding:'4px 10px', fontSize:12 }} onClick={handleDelete}>Delete</button>
        </div>
      )}
      {showEdit && <CertModal cert={cert} orgs={[]} onClose={() => setShowEdit(false)} onSave={onRefresh} />}
    </div>
  );
}

/* ── Requirements Tab ─────────────────────────────────────────── */
function RequirementsTab({ certs, selCert, setSelCert, canEdit, onRefresh }) {
  const [reqs,     setReqs]     = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterLevel, setFilterLevel]   = useState('');
  const [search,   setSearch]   = useState('');
  const [editReq,  setEditReq]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    if (!selCert) return;
    setLoading(true);
    api.get(`/certifications/${selCert}/requirements`)
      .then(r => setReqs(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selCert]);

  const visible = reqs.filter(r =>
    (!filterStatus || (r.resp_status || 'not_assessed') === filterStatus) &&
    (!filterLevel  || String(r.level) === filterLevel) &&
    (!search       || r.title.toLowerCase().includes(search.toLowerCase()) || r.req_id.includes(search))
  );

  const stats = reqs.reduce((a, r) => {
    const s = r.resp_status || 'not_assessed';
    a[s] = (a[s]||0) + 1;
    return a;
  }, {});

  return (
    <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', gap:20, alignItems:'start' }}>
      {/* Left panel — cert selector */}
      <div style={{ background:'var(--surface2)', border:'1px solid var(--border1)', borderRadius:12, overflow:'hidden' }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border1)', fontSize:12, fontWeight:700,
                      textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text3)' }}>
          Select Certification
        </div>
        {certs.length === 0 ? (
          <div style={{ padding:16, fontSize:13, color:'var(--text3)' }}>No certifications yet.</div>
        ) : certs.map(c => {
          const f = fw(c.framework);
          return (
            <div key={c.id} onClick={() => setSelCert(c.id)}
              style={{ padding:'12px 16px', cursor:'pointer', borderLeft:`3px solid ${selCert===c.id ? f.color : 'transparent'}`,
                       background: selCert===c.id ? `${f.color}10` : 'transparent',
                       borderBottom:'1px solid var(--border1)', transition:'background 0.15s' }}>
              <div style={{ fontSize:10, color:f.color, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>{f.label}</div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text1)', marginTop:2 }}>{c.name}</div>
              <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{c.org_name || 'No org'}</div>
              <div style={{ marginTop:6, height:4, background:'var(--surface3)', borderRadius:2 }}>
                <div style={{ height:'100%', width:`${c.completion_pct}%`, background:f.color, borderRadius:2 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Right panel */}
      <div>
        {!selCert ? (
          <div className="empty-state"><p>Select a certification to view its requirements.</p></div>
        ) : loading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : (
          <>
            {/* Stats chips */}
            <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
              {REQ_STATUSES.map(s => (
                <div key={s.id} onClick={() => setFilterStatus(filterStatus===s.id?'':s.id)}
                  style={{ padding:'5px 12px', borderRadius:16, cursor:'pointer', fontSize:12, fontWeight:600,
                           background: filterStatus===s.id ? `${s.color}30` : 'var(--surface3)',
                           border:`1px solid ${filterStatus===s.id ? s.color : 'var(--border2)'}`,
                           color:s.color, transition:'all 0.15s' }}>
                  {s.label} ({stats[s.id]||0})
                </div>
              ))}
              <button onClick={() => setFilterStatus('')}
                style={{ ...btnS('sm'), color:'var(--text3)', marginLeft:'auto' }}>Clear filter</button>
            </div>

            {/* Filters */}
            <div style={{ display:'flex', gap:10, marginBottom:16 }}>
              <input style={{ ...inp, maxWidth:280 }} placeholder="Search requirements..." value={search}
                     onChange={e => setSearch(e.target.value)} />
              <select style={{ ...sel, width:'auto', minWidth:130 }} value={filterLevel} onChange={e => setFilterLevel(e.target.value)}>
                <option value="">All levels</option>
                <option value="1">Main requirements</option>
                <option value="2">Sub-requirements</option>
              </select>
            </div>

            {/* Requirements list */}
            <div style={{ background:'var(--surface2)', border:'1px solid var(--border1)', borderRadius:12, overflow:'hidden' }}>
              {visible.length === 0 ? (
                <div style={{ padding:32, textAlign:'center', color:'var(--text3)', fontSize:13 }}>No matching requirements.</div>
              ) : visible.map(r => {
                const status = r.resp_status || 'not_assessed';
                const rStatus = rs(status);
                const isMain = r.level === 1;
                return (
                  <div key={r.id} style={{ borderBottom:'1px solid var(--border1)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
                                  background: isMain ? 'var(--surface3)' : 'transparent',
                                  paddingLeft: isMain ? 16 : 32, cursor:'pointer' }}
                         onClick={() => setExpanded(e => ({ ...e, [r.id]: !e[r.id] }))}>
                      <div style={{ width:36, fontSize:12, fontWeight:700, color:'var(--text3)',
                                    fontFamily:'monospace', flexShrink:0 }}>
                        {r.req_id}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight: isMain ? 700 : 500, color:'var(--text1)',
                                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {r.title}
                        </div>
                        {r.resp_notes && (
                          <div style={{ fontSize:11, color:'var(--text3)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {r.resp_notes}
                          </div>
                        )}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                        {r.assignee && <span style={{ fontSize:11, color:'var(--text3)' }}>{r.assignee}</span>}
                        {r.due_date && (
                          <span style={{ fontSize:11, color: isOverdue(r.due_date) && status !== 'compliant' ? '#ef4444' : 'var(--text3)' }}>
                            {fmtD(r.due_date)}
                          </span>
                        )}
                        {badge(rStatus.color, rStatus.label)}
                        {canEdit && (
                          <button style={{ ...btnS('sm') }} onClick={e => { e.stopPropagation(); setEditReq(r); }}>
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                    {expanded[r.id] && (
                      <div style={{ padding:'12px 16px 12px 64px', background:'var(--surface3)',
                                    borderTop:'1px solid var(--border1)' }}>
                        <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.6, marginBottom:8 }}>{r.description}</div>
                        {r.response && (
                          <div style={{ marginTop:8 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>Response</div>
                            <div style={{ fontSize:12, color:'var(--text1)', padding:'8px 12px', background:'var(--surface2)', borderRadius:6 }}>{r.response}</div>
                          </div>
                        )}
                        {r.evidence_notes && (
                          <div style={{ marginTop:8 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>Evidence</div>
                            <div style={{ fontSize:12, color:'var(--text1)', padding:'8px 12px', background:'var(--surface2)', borderRadius:6 }}>{r.evidence_notes}</div>
                          </div>
                        )}
                        {r.resp_updated && (
                          <div style={{ fontSize:11, color:'var(--text3)', marginTop:8 }}>Last updated: {fmtDT(r.resp_updated)}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {editReq && (
        <ReqModal req={editReq} certId={selCert} onClose={() => setEditReq(null)}
                  onSave={() => { setEditReq(null); api.get(`/certifications/${selCert}/requirements`).then(r => setReqs(r.data)); onRefresh(); }} />
      )}
    </div>
  );
}

/* ── Timeline Tab ─────────────────────────────────────────────── */
function TimelineTab({ certs, selCert, setSelCert, canEdit, onRefresh }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editEv,  setEditEv]  = useState(null);
  const [form,    setForm]    = useState({ event_type:'milestone', title:'', description:'', event_date:new Date().toISOString().slice(0,10), status:'planned' });

  const loadEvents = useCallback(() => {
    if (!selCert) return;
    setLoading(true);
    api.get(`/certifications/${selCert}/timeline`)
      .then(r => setEvents(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selCert]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const handleSaveEvent = async () => {
    if (!form.title.trim()) return;
    try {
      if (editEv) {
        await api.put(`/certifications/timeline/${editEv.id}`, form);
      } else {
        await api.post(`/certifications/${selCert}/timeline`, form);
      }
      setShowAdd(false); setEditEv(null);
      setForm({ event_type:'milestone', title:'', description:'', event_date:new Date().toISOString().slice(0,10), status:'planned' });
      loadEvents();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this event?')) return;
    await api.delete(`/certifications/timeline/${id}`).catch(console.error);
    loadEvents();
  };

  const statusColor = { planned:'#6b7280', completed:'#10b981', cancelled:'#9ca3af', overdue:'#ef4444' };

  const cert = certs.find(c => c.id === selCert);
  const certPhases = PHASES.map(p => ({
    ...p,
    isCurrent: cert?.phase === p.id,
  }));

  return (
    <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', gap:20, alignItems:'start' }}>
      {/* Cert selector */}
      <div style={{ background:'var(--surface2)', border:'1px solid var(--border1)', borderRadius:12, overflow:'hidden' }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border1)', fontSize:12, fontWeight:700,
                      textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text3)' }}>
          Select Certification
        </div>
        {certs.map(c => {
          const f = fw(c.framework);
          return (
            <div key={c.id} onClick={() => setSelCert(c.id)}
              style={{ padding:'12px 16px', cursor:'pointer', borderLeft:`3px solid ${selCert===c.id?f.color:'transparent'}`,
                       background: selCert===c.id?`${f.color}10`:'transparent', borderBottom:'1px solid var(--border1)' }}>
              <div style={{ fontSize:10, color:f.color, fontWeight:700, textTransform:'uppercase' }}>{f.label}</div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text1)', marginTop:2 }}>{c.name}</div>
              <div style={{ fontSize:11, color:'var(--text3)' }}>{c.org_name || 'No org'}</div>
            </div>
          );
        })}
      </div>

      {/* Timeline panel */}
      <div>
        {!selCert ? (
          <div className="empty-state"><p>Select a certification to view its timeline.</p></div>
        ) : (
          <>
            {/* Phase progress track */}
            {cert && (
              <div style={{ background:'var(--surface2)', border:'1px solid var(--border1)', borderRadius:12, padding:20, marginBottom:20 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:14 }}>
                  Certification Phase Progress
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:0, overflowX:'auto' }}>
                  {certPhases.map((p, i) => (
                    <React.Fragment key={p.id}>
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', minWidth:80 }}>
                        <div style={{ width:32, height:32, borderRadius:'50%', background: p.isCurrent?p.color:`${p.color}30`,
                                      border:`2px solid ${p.color}`, display:'flex', alignItems:'center', justifyContent:'center',
                                      fontSize:14, color: p.isCurrent?'#fff':p.color, fontWeight:700 }}>
                          {i+1}
                        </div>
                        <div style={{ fontSize:10, color: p.isCurrent?p.color:'var(--text3)', fontWeight: p.isCurrent?700:400,
                                      marginTop:5, textAlign:'center', whiteSpace:'nowrap' }}>
                          {p.label}
                        </div>
                      </div>
                      {i < certPhases.length-1 && (
                        <div style={{ flex:1, height:2, background:'var(--border1)', minWidth:16 }} />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline header */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div style={{ fontSize:15, fontWeight:700, color:'var(--text1)' }}>
                Events ({events.length})
              </div>
              {canEdit && (
                <button style={btnS('primary')} onClick={() => { setShowAdd(true); setEditEv(null); setForm({ event_type:'milestone', title:'', description:'', event_date:new Date().toISOString().slice(0,10), status:'planned' }); }}>
                  + Add Event
                </button>
              )}
            </div>

            {/* Add/Edit form */}
            {(showAdd || editEv) && (
              <div style={{ background:'var(--surface2)', border:'1px solid var(--border1)', borderRadius:12, padding:20, marginBottom:20 }}>
                <div style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>{editEv ? 'Edit Event' : 'New Timeline Event'}</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                  <div>
                    <label style={{ fontSize:12, color:'var(--text3)', display:'block', marginBottom:5 }}>Type</label>
                    <select style={sel} value={form.event_type} onChange={e => setForm(f=>({...f, event_type:e.target.value}))}>
                      {TL_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:12, color:'var(--text3)', display:'block', marginBottom:5 }}>Status</label>
                    <select style={sel} value={form.status} onChange={e => setForm(f=>({...f, status:e.target.value}))}>
                      {['planned','completed','cancelled','overdue'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:12, color:'var(--text3)', display:'block', marginBottom:5 }}>Date</label>
                    <input type="date" style={inp} value={form.event_date} onChange={e => setForm(f=>({...f, event_date:e.target.value}))} />
                  </div>
                  <div>
                    <label style={{ fontSize:12, color:'var(--text3)', display:'block', marginBottom:5 }}>Title *</label>
                    <input style={inp} value={form.title} onChange={e => setForm(f=>({...f, title:e.target.value}))} placeholder="Event title" />
                  </div>
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:12, color:'var(--text3)', display:'block', marginBottom:5 }}>Description</label>
                  <textarea style={{ ...inp, minHeight:70, resize:'vertical' }} value={form.description||''}
                             onChange={e => setForm(f=>({...f, description:e.target.value}))} placeholder="Optional details..." />
                </div>
                <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                  <button style={btnS('default')} onClick={() => { setShowAdd(false); setEditEv(null); }}>Cancel</button>
                  <button style={btnS('primary')} onClick={handleSaveEvent}>Save Event</button>
                </div>
              </div>
            )}

            {/* Timeline entries */}
            {loading ? <div className="empty-state"><div className="spinner" /></div> :
            events.length === 0 ? (
              <div className="empty-state"><p>No timeline events yet.</p></div>
            ) : (
              <div style={{ position:'relative', paddingLeft:40 }}>
                <div style={{ position:'absolute', left:16, top:0, bottom:0, width:2, background:'var(--border1)' }} />
                {events.map(ev => {
                  const t = tl(ev.event_type);
                  const sc = statusColor[ev.status] || '#6b7280';
                  return (
                    <div key={ev.id} style={{ position:'relative', marginBottom:20 }}>
                      <div style={{ position:'absolute', left:-32, top:10, width:28, height:28, borderRadius:'50%',
                                    background:'var(--surface2)', border:`2px solid ${t.color}`,
                                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>
                        {t.icon}
                      </div>
                      <div style={{ background:'var(--surface2)', border:'1px solid var(--border1)', borderRadius:10, padding:16 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                          <div>
                            <div style={{ fontSize:13, fontWeight:700, color:'var(--text1)' }}>{ev.title}</div>
                            <div style={{ fontSize:11, color:'var(--text3)', marginTop:3, display:'flex', gap:8 }}>
                              <span>📅 {fmtD(ev.event_date)}</span>
                              <span>🕐 {fmtDT(ev.created_at)}</span>
                              {ev.full_name && <span>👤 {ev.full_name || ev.username}</span>}
                            </div>
                          </div>
                          <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
                            {badge(sc, ev.status)}
                            {badge(t.color, ev.event_type)}
                            {canEdit && (
                              <>
                                <button style={btnS('sm')} onClick={() => { setEditEv(ev); setShowAdd(false); setForm({ event_type:ev.event_type, title:ev.title, description:ev.description||'', event_date:ev.event_date?.slice(0,10)||'', status:ev.status }); }}>Edit</button>
                                <button style={{ ...btnS('sm'), color:'#ef4444', border:'1px solid #ef4444' }} onClick={() => handleDelete(ev.id)}>✕</button>
                              </>
                            )}
                          </div>
                        </div>
                        {ev.description && <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.5 }}>{ev.description}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Workflows Tab ────────────────────────────────────────────── */
function WorkflowsTab({ certs, selCert, setSelCert, canEdit }) {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [newWfName, setNewWfName] = useState('');
  const [newWfDesc, setNewWfDesc] = useState('');
  const [showNewWf, setShowNewWf] = useState(false);

  const loadWf = useCallback(() => {
    if (!selCert) return;
    setLoading(true);
    api.get(`/certifications/${selCert}/workflows`)
      .then(r => setWorkflows(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selCert]);

  useEffect(() => { loadWf(); }, [loadWf]);

  const createWf = async () => {
    if (!newWfName.trim()) return;
    await api.post(`/certifications/${selCert}/workflows`, { name: newWfName, description: newWfDesc }).catch(console.error);
    setNewWfName(''); setNewWfDesc(''); setShowNewWf(false); loadWf();
  };

  const deleteWf = async id => {
    if (!window.confirm('Delete this workflow?')) return;
    await api.delete(`/certifications/workflows/${id}`).catch(console.error);
    loadWf();
  };

  return (
    <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', gap:20, alignItems:'start' }}>
      {/* Cert selector */}
      <div style={{ background:'var(--surface2)', border:'1px solid var(--border1)', borderRadius:12, overflow:'hidden' }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border1)', fontSize:12, fontWeight:700,
                      textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text3)' }}>
          Select Certification
        </div>
        {certs.map(c => {
          const f = fw(c.framework);
          return (
            <div key={c.id} onClick={() => setSelCert(c.id)}
              style={{ padding:'12px 16px', cursor:'pointer', borderLeft:`3px solid ${selCert===c.id?f.color:'transparent'}`,
                       background: selCert===c.id?`${f.color}10`:'transparent', borderBottom:'1px solid var(--border1)' }}>
              <div style={{ fontSize:10, color:f.color, fontWeight:700, textTransform:'uppercase' }}>{f.label}</div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text1)', marginTop:2 }}>{c.name}</div>
              <div style={{ fontSize:11, color:'var(--text3)' }}>{c.org_name || 'No org'}</div>
            </div>
          );
        })}
      </div>

      {/* Workflows panel */}
      <div>
        {!selCert ? (
          <div className="empty-state"><p>Select a certification to view its workflows.</p></div>
        ) : (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div style={{ fontSize:15, fontWeight:700, color:'var(--text1)' }}>Workflows ({workflows.length})</div>
              {canEdit && <button style={btnS('primary')} onClick={() => setShowNewWf(true)}>+ New Workflow</button>}
            </div>

            {showNewWf && (
              <div style={{ background:'var(--surface2)', border:'1px solid var(--border1)', borderRadius:12, padding:20, marginBottom:20 }}>
                <div style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>New Workflow</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                  <div>
                    <label style={{ fontSize:12, color:'var(--text3)', display:'block', marginBottom:5 }}>Name *</label>
                    <input style={inp} value={newWfName} onChange={e => setNewWfName(e.target.value)} placeholder="e.g., Gap Remediation" />
                  </div>
                  <div>
                    <label style={{ fontSize:12, color:'var(--text3)', display:'block', marginBottom:5 }}>Description</label>
                    <input style={inp} value={newWfDesc} onChange={e => setNewWfDesc(e.target.value)} placeholder="Optional" />
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                  <button style={btnS('default')} onClick={() => setShowNewWf(false)}>Cancel</button>
                  <button style={btnS('primary')} onClick={createWf}>Create Workflow</button>
                </div>
              </div>
            )}

            {loading ? <div className="empty-state"><div className="spinner" /></div> :
            workflows.length === 0 ? (
              <div className="empty-state"><p>No workflows yet. Create one to track certification steps.</p></div>
            ) : (
              workflows.map(wf => (
                <WorkflowCard key={wf.id} workflow={wf} canEdit={canEdit} onRefresh={loadWf} onDelete={() => deleteWf(wf.id)} />
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

function WorkflowCard({ workflow, canEdit, onDelete }) {
  const [steps, setSteps] = useState(workflow.steps || []);
  const [showAdd, setShowAdd] = useState(false);
  const [stepForm, setStepForm] = useState({ title:'', description:'', assignee:'', due_date:'' });
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => setSteps(workflow.steps || []), [workflow.steps]);

  const completed = steps.filter(s => s.status === 'completed').length;
  const pct = steps.length ? Math.round(100 * completed / steps.length) : 0;

  const updateStep = async (id, field, value) => {
    const s = steps.find(s => s.id === id);
    const updated = { ...s, [field]: value };
    await api.put(`/certifications/workflows/steps/${id}`, updated).catch(console.error);
    setSteps(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const addStep = async () => {
    if (!stepForm.title.trim()) return;
    const r = await api.post(`/certifications/workflows/${workflow.id}/steps`, stepForm).catch(console.error);
    if (r?.data) { setSteps(prev => [...prev, r.data]); setStepForm({ title:'', description:'', assignee:'', due_date:'' }); setShowAdd(false); }
  };

  const deleteStep = async id => {
    await api.delete(`/certifications/workflows/steps/${id}`).catch(console.error);
    setSteps(prev => prev.filter(s => s.id !== id));
  };

  const wfStatusColor = { active:'#10b981', completed:'#3b82f6', cancelled:'#9ca3af' };

  return (
    <div style={{ background:'var(--surface2)', border:'1px solid var(--border1)', borderRadius:12, marginBottom:16, overflow:'hidden' }}>
      {/* Workflow header */}
      <div style={{ padding:'16px 20px', background:'var(--surface3)', display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ cursor:'pointer', fontSize:14, color:'var(--text3)' }} onClick={() => setCollapsed(c => !c)}>
          {collapsed ? '▶' : '▼'}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--text1)' }}>{workflow.name}</div>
            {badge(wfStatusColor[workflow.status]||'#6b7280', workflow.status)}
          </div>
          {workflow.description && <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{workflow.description}</div>}
        </div>
        <div style={{ textAlign:'right', minWidth:90 }}>
          <div style={{ fontSize:18, fontWeight:700, color:pct===100?'#10b981':'var(--accent)' }}>{pct}%</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>{completed}/{steps.length} done</div>
        </div>
        {canEdit && (
          <button style={{ ...btnS('danger'), padding:'4px 10px', fontSize:12 }} onClick={onDelete}>Delete</button>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ height:4, background:'var(--border1)' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:pct===100?'#10b981':'var(--accent)', transition:'width 0.3s' }} />
      </div>

      {!collapsed && (
        <div style={{ padding:20 }}>
          {steps.length === 0 ? (
            <div style={{ fontSize:13, color:'var(--text3)', textAlign:'center', padding:'16px 0' }}>No steps yet.</div>
          ) : (
            steps.map((s, i) => {
              const sc = STEP_STATUSES.find(st => st.id === s.status) || STEP_STATUSES[0];
              return (
                <div key={s.id} style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:12,
                                          padding:'12px 14px', background:'var(--surface3)', borderRadius:8,
                                          borderLeft:`3px solid ${sc.color}` }}>
                  <div style={{ width:26, height:26, borderRadius:'50%', background:sc.color, color:'#fff',
                                 display:'flex', alignItems:'center', justifyContent:'center', fontSize:12,
                                 fontWeight:700, flexShrink:0, marginTop:1 }}>
                    {i+1}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--text1)', textDecoration: s.status==='completed'?'line-through':'none' }}>
                      {s.title}
                    </div>
                    {s.description && <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{s.description}</div>}
                    <div style={{ display:'flex', gap:12, marginTop:6, fontSize:11, color:'var(--text3)' }}>
                      {s.assignee && <span>👤 {s.assignee}</span>}
                      {s.due_date && (
                        <span style={{ color: isOverdue(s.due_date) && s.status !== 'completed' ? '#ef4444' : 'var(--text3)' }}>
                          📅 {fmtD(s.due_date)}
                        </span>
                      )}
                      {s.completed_at && <span style={{ color:'#10b981' }}>✅ {fmtDT(s.completed_at)}</span>}
                    </div>
                  </div>
                  {canEdit && (
                    <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                      <select style={{ ...sel, width:'auto', fontSize:11, padding:'3px 8px' }}
                              value={s.status} onChange={e => updateStep(s.id, 'status', e.target.value)}>
                        {STEP_STATUSES.map(st => <option key={st.id} value={st.id}>{st.label}</option>)}
                      </select>
                      <button style={{ ...btnS('sm'), color:'#ef4444', border:'1px solid #ef4444', padding:'3px 8px' }}
                              onClick={() => deleteStep(s.id)}>✕</button>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {canEdit && (
            showAdd ? (
              <div style={{ padding:'12px 14px', background:'var(--surface3)', borderRadius:8, marginTop:8 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                  <input style={inp} placeholder="Step title *" value={stepForm.title} onChange={e => setStepForm(f=>({...f,title:e.target.value}))} />
                  <input style={inp} placeholder="Assignee" value={stepForm.assignee} onChange={e => setStepForm(f=>({...f,assignee:e.target.value}))} />
                  <input style={inp} placeholder="Description" value={stepForm.description} onChange={e => setStepForm(f=>({...f,description:e.target.value}))} />
                  <input type="date" style={inp} value={stepForm.due_date} onChange={e => setStepForm(f=>({...f,due_date:e.target.value}))} />
                </div>
                <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                  <button style={btnS('default')} onClick={() => setShowAdd(false)}>Cancel</button>
                  <button style={btnS('primary')} onClick={addStep}>Add Step</button>
                </div>
              </div>
            ) : (
              <button style={{ ...btnS('default'), marginTop:8, width:'100%', textAlign:'center' }}
                      onClick={() => setShowAdd(true)}>+ Add Step</button>
            )
          )}
        </div>
      )}
    </div>
  );
}

/* ── Modals ───────────────────────────────────────────────────── */
function CertModal({ cert, orgs, onClose, onSave }) {
  const [form, setForm] = useState({
    org_id:         cert?.org_id         || '',
    framework:      cert?.framework      || 'PCIDSS',
    name:           cert?.name           || '',
    scope:          cert?.scope          || '',
    phase:          cert?.phase          || 'planning',
    target_date:    cert?.target_date?.slice(0,10) || '',
    certified_date: cert?.certified_date?.slice(0,10) || '',
    expiry_date:    cert?.expiry_date?.slice(0,10) || '',
    auditor:        cert?.auditor        || '',
    owner:          cert?.owner          || '',
    status:         cert?.status         || 'active',
    notes:          cert?.notes          || '',
  });
  const [err, setErr] = useState('');

  const submit = async e => {
    e.preventDefault(); setErr('');
    try {
      if (cert) {
        await api.put(`/certifications/${cert.id}`, form);
      } else {
        await api.post('/certifications', form);
      }
      onSave(); onClose();
    } catch (ex) { setErr(ex.response?.data?.error || 'Error'); }
  };

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:600 }}>
        <div className="modal-header">
          <h2>{cert ? 'Edit Certification' : 'New Certification'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ maxHeight:'70vh', overflowY:'auto' }}>
            {err && <div className="alert alert-error" style={{ marginBottom:12 }}>{err}</div>}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <div className="form-group" style={{ gridColumn:'span 2' }}>
                <label>Certification Name *</label>
                <input style={inp} value={form.name} onChange={f('name')} required placeholder="e.g., PCI DSS Certification 2026" />
              </div>
              <div className="form-group">
                <label>Framework *</label>
                <select style={sel} value={form.framework} onChange={f('framework')}>
                  {FRAMEWORKS.map(fw => <option key={fw.id} value={fw.id}>{fw.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Organization</label>
                <select style={sel} value={form.org_id} onChange={f('org_id')}>
                  <option value="">No organization</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Phase</label>
                <select style={sel} value={form.phase} onChange={f('phase')}>
                  {PHASES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select style={sel} value={form.status} onChange={f('status')}>
                  {['active','paused','completed','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Target Date</label>
                <input type="date" style={inp} value={form.target_date} onChange={f('target_date')} />
              </div>
              <div className="form-group">
                <label>Certified Date</label>
                <input type="date" style={inp} value={form.certified_date} onChange={f('certified_date')} />
              </div>
              <div className="form-group">
                <label>Expiry Date</label>
                <input type="date" style={inp} value={form.expiry_date} onChange={f('expiry_date')} />
              </div>
              <div className="form-group">
                <label>Owner</label>
                <input style={inp} value={form.owner} onChange={f('owner')} placeholder="Name or team" />
              </div>
              <div className="form-group">
                <label>Auditor / QSA</label>
                <input style={inp} value={form.auditor} onChange={f('auditor')} placeholder="Auditing firm or name" />
              </div>
              <div className="form-group" style={{ gridColumn:'span 2' }}>
                <label>Scope</label>
                <textarea style={{ ...inp, minHeight:60, resize:'vertical' }} value={form.scope} onChange={f('scope')}
                           placeholder="Define the scope of this certification..." />
              </div>
              <div className="form-group" style={{ gridColumn:'span 2' }}>
                <label>Notes</label>
                <textarea style={{ ...inp, minHeight:60, resize:'vertical' }} value={form.notes} onChange={f('notes')} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{cert ? 'Save Changes' : 'Create Certification'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function OrgModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name:'', industry:'', contact:'', description:'' });
  const [err, setErr] = useState('');

  const submit = async e => {
    e.preventDefault(); setErr('');
    try {
      await api.post('/certifications/organizations', form);
      onSave(); onClose();
    } catch (ex) { setErr(ex.response?.data?.error || 'Error'); }
  };

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:480 }}>
        <div className="modal-header">
          <h2>New Organization</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {err && <div className="alert alert-error" style={{ marginBottom:12 }}>{err}</div>}
            <div className="form-group"><label>Organization Name *</label><input style={inp} value={form.name} onChange={f('name')} required /></div>
            <div className="form-group"><label>Industry</label><input style={inp} value={form.industry} onChange={f('industry')} placeholder="e.g., Financial Services" /></div>
            <div className="form-group"><label>Contact</label><input style={inp} value={form.contact} onChange={f('contact')} placeholder="Primary contact name" /></div>
            <div className="form-group"><label>Description</label><textarea style={{ ...inp, minHeight:70, resize:'vertical' }} value={form.description} onChange={f('description')} /></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create Organization</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReqModal({ req, certId, onClose, onSave }) {
  const [form, setForm] = useState({
    status:         req.resp_status     || 'not_assessed',
    response:       req.response        || '',
    evidence_notes: req.evidence_notes  || '',
    assignee:       req.assignee        || '',
    due_date:       req.due_date?.slice(0,10) || '',
    completed_date: req.completed_date?.slice(0,10) || '',
    notes:          req.resp_notes      || '',
  });
  const [err, setErr] = useState('');

  const submit = async e => {
    e.preventDefault(); setErr('');
    try {
      await api.put(`/certifications/${certId}/requirements/${req.id}`, form);
      onSave();
    } catch (ex) { setErr(ex.response?.data?.error || 'Error'); }
  };

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:560 }}>
        <div className="modal-header">
          <h2><span style={{ fontFamily:'monospace', fontSize:14, color:'var(--text3)' }}>{req.req_id}</span> — Requirement Response</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ maxHeight:'65vh', overflowY:'auto' }}>
            {err && <div className="alert alert-error" style={{ marginBottom:12 }}>{err}</div>}
            <div style={{ padding:'12px 14px', background:'var(--surface3)', borderRadius:8, marginBottom:16, fontSize:13, color:'var(--text2)' }}>
              {req.title}
              {req.description && <div style={{ fontSize:12, color:'var(--text3)', marginTop:6, lineHeight:1.5 }}>{req.description}</div>}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <div className="form-group">
                <label>Compliance Status</label>
                <select style={sel} value={form.status} onChange={f('status')}>
                  {REQ_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Assignee</label>
                <input style={inp} value={form.assignee} onChange={f('assignee')} placeholder="Person responsible" />
              </div>
              <div className="form-group">
                <label>Due Date</label>
                <input type="date" style={inp} value={form.due_date} onChange={f('due_date')} />
              </div>
              <div className="form-group">
                <label>Completed Date</label>
                <input type="date" style={inp} value={form.completed_date} onChange={f('completed_date')} />
              </div>
              <div className="form-group" style={{ gridColumn:'span 2' }}>
                <label>Response / Implementation Description</label>
                <textarea style={{ ...inp, minHeight:80, resize:'vertical' }} value={form.response} onChange={f('response')}
                           placeholder="Describe how this requirement is being met..." />
              </div>
              <div className="form-group" style={{ gridColumn:'span 2' }}>
                <label>Evidence Notes</label>
                <textarea style={{ ...inp, minHeight:60, resize:'vertical' }} value={form.evidence_notes} onChange={f('evidence_notes')}
                           placeholder="Reference to evidence documents, screenshots, logs..." />
              </div>
              <div className="form-group" style={{ gridColumn:'span 2' }}>
                <label>Additional Notes</label>
                <textarea style={{ ...inp, minHeight:60, resize:'vertical' }} value={form.notes} onChange={f('notes')} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Response</button>
          </div>
        </form>
      </div>
    </div>
  );
}
