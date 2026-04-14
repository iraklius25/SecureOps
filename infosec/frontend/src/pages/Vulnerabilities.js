import React, { useState, useEffect, useCallback, useContext } from 'react';
import { api, AuthContext } from '../App';
import { format, differenceInDays } from 'date-fns';

const SEVS    = ['critical','high','medium','low','informational'];
const STATUSES = ['open','in_progress','mitigated','accepted','false_positive','closed'];
const fmt$ = n => n == null ? '—' : '$' + parseFloat(n).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0});

function SLABadge({ detected_at, due_date, status }) {
  if (['closed','mitigated','false_positive'].includes(status)) return null;
  const daysOpen = detected_at ? differenceInDays(new Date(), new Date(detected_at)) : null;
  const overdue  = due_date && new Date(due_date) < new Date();
  if (overdue) return <span style={{ fontSize: 10, padding: '1px 5px', background: 'var(--critical)', color: '#fff', borderRadius: 3, fontWeight: 600 }}>OVERDUE</span>;
  if (daysOpen > 30) return <span style={{ fontSize: 10, padding: '1px 5px', background: 'var(--high)', color: '#fff', borderRadius: 3 }}>{daysOpen}d open</span>;
  return null;
}

function VulnComments({ vulnId }) {
  const { user } = useContext(AuthContext);
  const [comments, setComments] = useState([]);
  const [text,     setText]     = useState('');
  const [loading,  setLoading]  = useState(true);
  const canComment = ['admin','analyst'].includes(user?.role);

  const load = () => api.get(`/vulns/${vulnId}/comments`)
    .then(r => setComments(r.data)).finally(() => setLoading(false));

  useEffect(() => { load(); }, [vulnId]);

  const submit = async e => {
    e.preventDefault();
    if (!text.trim()) return;
    await api.post(`/vulns/${vulnId}/comments`, { comment: text.trim() });
    setText(''); load();
  };

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
        Comments ({comments.length})
      </div>
      {loading ? <div className="spinner" style={{ margin: '10px auto' }} /> : (
        <>
          <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 10 }}>
            {comments.length === 0 && <div style={{ fontSize: 12, color: 'var(--text3)' }}>No comments yet.</div>}
            {comments.map(c => (
              <div key={c.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>
                    {(c.username || 'S')[0].toUpperCase()}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)' }}>{c.full_name || c.username || 'System'}</span>
                  <span style={{ fontSize: 10, color: 'var(--text3)' }}>{format(new Date(c.created_at), 'MMM d HH:mm')}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, paddingLeft: 28 }}>{c.comment}</div>
              </div>
            ))}
          </div>
          {canComment && (
            <form onSubmit={submit} style={{ display: 'flex', gap: 8 }}>
              <input value={text} onChange={e => setText(e.target.value)} placeholder="Add a comment..."
                style={{ flex: 1, fontSize: 12 }} />
              <button type="submit" className="btn btn-primary btn-sm" disabled={!text.trim()}>Post</button>
            </form>
          )}
        </>
      )}
    </div>
  );
}

function VulnDetail({ vuln, onClose, onUpdated }) {
  const { user }  = useContext(AuthContext);
  const [status,  setStatus]  = useState(vuln.status);
  const [av,      setAv]      = useState(vuln.asset_value || 50000);
  const [ef,      setEf]      = useState(vuln.exposure_factor || 30);
  const [aro,     setAro]     = useState(vuln.aro || 0.25);
  const [dueDate, setDueDate] = useState(vuln.due_date ? vuln.due_date.slice(0,10) : '');
  const [users,   setUsers]   = useState([]);
  const [assignee,setAssignee]= useState(vuln.assigned_to || '');
  const [saving,  setSaving]  = useState(false);
  const sle = av * ef / 100;
  const ale = sle * aro;
  const canEdit = ['admin','analyst'].includes(user?.role);
  const daysOpen = vuln.detected_at ? differenceInDays(new Date(), new Date(vuln.detected_at)) : null;

  useEffect(() => {
    api.get('/users').then(r => setUsers(r.data)).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    await api.patch(`/vulns/${vuln.id}`, { status, asset_value: av, exposure_factor: ef, aro, due_date: dueDate || null, assigned_to: assignee || null });
    setSaving(false); onUpdated();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{maxWidth:720}}>
        <div className="modal-header">
          <h2>Vulnerability Detail</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{display:'flex',flexDirection:'column',gap:14}}>
          {/* Header */}
          <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
            <span className={`badge badge-${vuln.severity}`}>{vuln.severity}</span>
            {vuln.cve_id && <a href={`https://nvd.nist.gov/vuln/detail/${vuln.cve_id}`} target="_blank" rel="noopener noreferrer" style={{color:'var(--info)',fontSize:12}}>{vuln.cve_id} ↗</a>}
            {vuln.cvss_score && <span style={{fontSize:12,color:'var(--text2)'}}>CVSS {vuln.cvss_score}</span>}
            {daysOpen !== null && <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>{daysOpen} days open</span>}
            {vuln.due_date && new Date(vuln.due_date) < new Date() && (
              <span style={{ fontSize: 11, background: 'var(--critical)', color: '#fff', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>OVERDUE</span>
            )}
          </div>

          {/* Title + description */}
          <div>
            <div style={{fontWeight:600,fontSize:15,marginBottom:6}}>{vuln.title}</div>
            <div style={{fontSize:13,color:'var(--text2)',lineHeight:1.6}}>{vuln.description}</div>
          </div>

          {/* Evidence */}
          {vuln.evidence && (
            <div style={{background:'var(--bg3)',borderRadius:'var(--radius)',padding:'10px 12px',fontSize:12,fontFamily:'monospace',color:'var(--text2)',wordBreak:'break-all'}}>
              <div style={{color:'var(--text3)',marginBottom:4,fontSize:11}}>EVIDENCE</div>{vuln.evidence}
            </div>
          )}

          {/* Remediation */}
          {vuln.remediation && (
            <div style={{background:'rgba(63,185,80,0.07)',border:'1px solid rgba(63,185,80,0.2)',borderRadius:'var(--radius)',padding:'10px 12px'}}>
              <div style={{color:'var(--low)',fontSize:11,marginBottom:4}}>REMEDIATION</div>
              <div style={{fontSize:13,color:'var(--text)'}}>{vuln.remediation}</div>
            </div>
          )}

          {/* ALE calculator */}
          <div style={{border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'14px'}}>
            <div style={{fontSize:12,color:'var(--text3)',marginBottom:12,fontFamily:'monospace',textTransform:'uppercase',letterSpacing:'0.05em'}}>Risk Quantification (ALE)</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10}}>
              <div className="form-group" style={{marginBottom:0}}>
                <label>Asset Value ($)</label>
                <input type="number" value={av} onChange={e=>setAv(parseFloat(e.target.value)||0)} disabled={!canEdit} />
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <label>Exposure Factor (%)</label>
                <input type="number" value={ef} onChange={e=>setEf(parseFloat(e.target.value)||0)} min="0" max="100" disabled={!canEdit} />
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <label>ARO (events/yr)</label>
                <input type="number" value={aro} onChange={e=>setAro(parseFloat(e.target.value)||0)} step="0.01" disabled={!canEdit} />
              </div>
            </div>
            <div style={{display:'flex',gap:20,fontSize:13}}>
              <span style={{color:'var(--text2)'}}>SLE: <strong style={{color:'var(--text)',fontFamily:'monospace'}}>{fmt$(sle)}</strong></span>
              <span style={{color:'var(--text2)'}}>ALE: <strong style={{color: ale > 50000 ? 'var(--critical)' : ale > 10000 ? 'var(--high)' : 'var(--medium)',fontFamily:'monospace'}}>{fmt$(ale)}</strong></span>
            </div>
          </div>

          {/* Workflow */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
            <div className="form-group" style={{marginBottom:0}}>
              <label>Status</label>
              <select value={status} onChange={e=>setStatus(e.target.value)} disabled={!canEdit}>
                {STATUSES.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group" style={{marginBottom:0}}>
              <label>Assigned To</label>
              <select value={assignee} onChange={e=>setAssignee(e.target.value)} disabled={!canEdit}>
                <option value="">— Unassigned —</option>
                {users.map(u=><option key={u.id} value={u.id}>{u.full_name || u.username}</option>)}
              </select>
            </div>
            <div className="form-group" style={{marginBottom:0}}>
              <label>Due Date</label>
              <input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} disabled={!canEdit} />
            </div>
          </div>

          {/* Asset info */}
          {vuln.ip_address && (
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
              Asset: <span className="mono" style={{color:'var(--info)'}}>{vuln.ip_address}</span>
              {vuln.hostname && ` (${vuln.hostname})`}
              {vuln.department && <span style={{ marginLeft: 8, color: 'var(--text3)' }}>· {vuln.department}</span>}
            </div>
          )}

          {/* Comments */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <VulnComments vulnId={vuln.id} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          {canEdit && <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>}
        </div>
      </div>
    </div>
  );
}

function AddVulnModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ asset_ip: '', title: '', description: '', severity: 'medium', cve_id: '', cvss_score: '', vuln_type: 'Manual', remediation: '', asset_value: 50000, exposure_factor: 30, aro: 0.25 });
  const [assets, setAssets] = useState([]);
  const [err, setErr] = useState('');
  const set = k => e => setForm(p => ({...p, [k]: e.target.value}));

  useEffect(() => {
    api.get('/assets', { params: { limit: 200, status: 'active' } }).then(r => setAssets(r.data.data));
  }, []);

  const submit = async e => {
    e.preventDefault(); setErr('');
    const asset = assets.find(a => a.ip_address === form.asset_ip || a.id === form.asset_ip);
    if (!asset) return setErr('Select a valid asset');
    try {
      await api.post('/vulns', { ...form, asset_id: asset.id, cvss_score: form.cvss_score || null });
      onSaved();
    } catch(ex) { setErr(ex.response?.data?.error || 'Error'); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <h2>Add Vulnerability</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {err && <div className="alert alert-error">{err}</div>}
            <div className="form-group">
              <label>Asset *</label>
              <select value={form.asset_ip} onChange={set('asset_ip')} required>
                <option value="">Select asset...</option>
                {assets.map(a => <option key={a.id} value={a.ip_address}>{a.ip_address}{a.hostname ? ` — ${a.hostname}` : ''}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Title *</label><input value={form.title} onChange={set('title')} required placeholder="e.g. Outdated OpenSSL version" /></div>
            <div className="form-row">
              <div className="form-group"><label>Severity *</label><select value={form.severity} onChange={set('severity')}>{SEVS.map(s=><option key={s}>{s}</option>)}</select></div>
              <div className="form-group"><label>Type</label><input value={form.vuln_type} onChange={set('vuln_type')} placeholder="Manual" /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>CVE ID</label><input value={form.cve_id} onChange={set('cve_id')} placeholder="CVE-2024-1234" /></div>
              <div className="form-group"><label>CVSS Score</label><input type="number" value={form.cvss_score} onChange={set('cvss_score')} min="0" max="10" step="0.1" placeholder="7.5" /></div>
            </div>
            <div className="form-group"><label>Description</label><textarea value={form.description} onChange={set('description')} rows={2} /></div>
            <div className="form-group"><label>Remediation</label><textarea value={form.remediation} onChange={set('remediation')} rows={2} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div className="form-group" style={{ marginBottom: 0 }}><label>Asset Value ($)</label><input type="number" value={form.asset_value} onChange={set('asset_value')} /></div>
              <div className="form-group" style={{ marginBottom: 0 }}><label>Exposure Factor (%)</label><input type="number" value={form.exposure_factor} onChange={set('exposure_factor')} min="0" max="100" /></div>
              <div className="form-group" style={{ marginBottom: 0 }}><label>ARO (events/yr)</label><input type="number" value={form.aro} onChange={set('aro')} step="0.01" /></div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add Vulnerability</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Vulnerabilities() {
  const [vulns,    setVulns]    = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [search,   setSearch]   = useState('');
  const [severity, setSev]      = useState('');
  const [status,   setStatus]   = useState('open');
  const [selected, setSelected] = useState(null);
  const [addModal, setAddModal] = useState(false);
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/vulns', { params: { page, limit: 50, search, severity, status } })
      .then(r => { setVulns(r.data.data); setTotal(r.data.total); })
      .finally(() => setLoading(false));
  }, [page, search, severity, status]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Vulnerabilities</div><div className="page-subtitle">{total} findings</div></div>
        <button className="btn btn-primary" onClick={() => setAddModal(true)}>+ Add Vulnerability</button>
      </div>

      <div className="filter-bar">
        <input className="search-input" placeholder="Search title, CVE..." value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} />
        <select className="filter-select" value={severity} onChange={e=>{setSev(e.target.value);setPage(1);}}>
          <option value="">All severity</option>{SEVS.map(s=><option key={s}>{s}</option>)}
        </select>
        <select className="filter-select" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}>
          <option value="">All status</option>{STATUSES.map(s=><option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="card" style={{padding:0}}>
        <div className="table-wrap">
          {loading ? <div className="empty-state"><div className="spinner"/></div> :
          vulns.length === 0 ? <div className="empty-state"><div className="empty-icon">✅</div><p>No vulnerabilities found</p></div> :
          <table>
            <thead><tr>
              <th>Severity</th><th>Title</th><th>CVE</th><th>CVSS</th>
              <th>Asset</th><th>ALE</th><th>Status</th><th>SLA</th><th>Detected</th>
            </tr></thead>
            <tbody>
              {vulns.map(v => (
                <tr key={v.id} style={{cursor:'pointer'}} onClick={() => setSelected(v)}>
                  <td><span className={`badge badge-${v.severity}`}>{v.severity}</span></td>
                  <td style={{maxWidth:260}}>
                    <div style={{fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.title}</div>
                    <div style={{fontSize:11,color:'var(--text3)'}}>{v.vuln_type}</div>
                  </td>
                  <td className="mono">{v.cve_id || <span className="text-dim">—</span>}</td>
                  <td className="mono">{v.cvss_score || <span className="text-dim">—</span>}</td>
                  <td className="mono" style={{color:'var(--info)'}}>
                    {v.ip_address}
                    {v.hostname && <><br/><span style={{fontSize:11,color:'var(--text3)'}}>{v.hostname}</span></>}
                  </td>
                  <td className={`ale-value ${v.ale > 50000 ? 'ale-high' : v.ale > 10000 ? 'ale-med' : 'ale-low'}`}>
                    {v.ale ? '$'+parseFloat(v.ale).toLocaleString('en-US',{maximumFractionDigits:0}) : '—'}
                  </td>
                  <td><span className={`badge badge-${v.status}`}>{v.status}</span></td>
                  <td><SLABadge detected_at={v.detected_at} due_date={v.due_date} status={v.status} /></td>
                  <td className="text-dim">{v.detected_at ? format(new Date(v.detected_at),'MMM d') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>}
        </div>
      </div>

      <div className="pagination">
        <span className="page-info">{total} total</span>
        {Array.from({length: Math.ceil(total/50)}, (_,i) => i+1).slice(0,10).map(p => (
          <button key={p} className={`page-btn ${p===page?'active':''}`} onClick={() => setPage(p)}>{p}</button>
        ))}
      </div>

      {selected && <VulnDetail vuln={selected} onClose={() => setSelected(null)} onUpdated={() => { setSelected(null); load(); }} />}
      {addModal && <AddVulnModal onClose={() => setAddModal(false)} onSaved={() => { setAddModal(false); load(); }} />}
    </div>
  );
}
