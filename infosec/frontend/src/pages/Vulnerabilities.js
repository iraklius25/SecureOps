import React, { useState, useEffect, useCallback, useContext } from 'react';
import { api, AuthContext } from '../App';
import { format, differenceInDays } from 'date-fns';
import { RequestApprovalModal } from './Approvals';

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

/* ─── CVE Panel ───────────────────────────────────────── */
const CVSS_COLOR = score =>
  score >= 9.0 ? '#ef4444' :
  score >= 7.0 ? '#f97316' :
  score >= 4.0 ? '#eab308' : '#22c55e';

const CVSS_LABEL = score =>
  score >= 9.0 ? 'Critical' :
  score >= 7.0 ? 'High' :
  score >= 4.0 ? 'Medium' : 'Low';

function CVEPanel({ cveId }) {
  const [cve,     setCve]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // Auto-load if we already have this CVE cached
  useEffect(() => {
    if (!cveId) return;
    setLoading(true); setError('');
    api.get(`/cve/${encodeURIComponent(cveId)}`)
      .then(r  => setCve(r.data))
      .catch(() => setCve(null))   // silently ignore — user can retry
      .finally(() => setLoading(false));
  }, [cveId]);

  const fetch = () => {
    setLoading(true); setError(''); setCve(null);
    api.get(`/cve/${encodeURIComponent(cveId)}`)
      .then(r => setCve(r.data))
      .catch(e => setError(e.response?.data?.error || 'NVD lookup failed'))
      .finally(() => setLoading(false));
  };

  if (!cveId) return null;

  const patchRefs  = cve?.references?.filter(r => r.tags?.includes('Patch'))            || [];
  const vendorRefs = cve?.references?.filter(r => r.tags?.includes('Vendor Advisory'))  || [];
  const otherRefs  = cve?.references?.filter(r => !r.tags?.includes('Patch') && !r.tags?.includes('Vendor Advisory')) || [];

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'var(--bg3)', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--info)' }}>{cveId}</span>
          {cve && <span style={{ fontSize: 11, color: 'var(--text3)' }}>· {cve.cached ? 'cached' : 'live from NVD'}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {cve && (
            <a
              href={`https://nvd.nist.gov/vuln/detail/${cveId}`}
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, color: 'var(--info)' }}
            >View on NVD ↗</a>
          )}
          <button className="btn btn-secondary btn-sm" onClick={fetch} disabled={loading}>
            {loading ? 'Loading…' : cve ? '↺ Refresh' : '↓ Fetch CVE Data'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '10px 14px', color: 'var(--critical)', fontSize: 12 }}>{error}</div>
      )}

      {/* Placeholder */}
      {!cve && !loading && !error && (
        <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text3)' }}>
          Click "Fetch CVE Data" to load live details from the NIST National Vulnerability Database.
        </div>
      )}

      {/* CVE Data */}
      {cve && (
        <div style={{ padding: '14px' }}>
          {/* CVSS score + description row */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 14 }}>
            {/* Score circle */}
            {cve.cvss_score != null && (
              <div style={{ flexShrink: 0, textAlign: 'center' }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: CVSS_COLOR(cve.cvss_score),
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700,
                }}>
                  <div style={{ fontSize: 20, lineHeight: 1 }}>{cve.cvss_score.toFixed(1)}</div>
                  <div style={{ fontSize: 9, marginTop: 2, opacity: 0.9 }}>CVSS {cve.cvss_version}</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, color: CVSS_COLOR(cve.cvss_score) }}>
                  {CVSS_LABEL(cve.cvss_score)}
                </div>
              </div>
            )}

            <div style={{ flex: 1, fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>
              {cve.description || <span style={{ color: 'var(--text3)' }}>No description available.</span>}
            </div>
          </div>

          {/* CVSS vector */}
          {cve.cvss_vector && (
            <div style={{ marginBottom: 10, fontFamily: 'monospace', fontSize: 11,
                          background: 'var(--bg3)', padding: '6px 10px', borderRadius: 4,
                          color: 'var(--text2)', wordBreak: 'break-all' }}>
              {cve.cvss_vector}
            </div>
          )}

          {/* CWE IDs */}
          {cve.cwe_ids?.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>CWE:</span>
              {cve.cwe_ids.map(c => (
                <span key={c} style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px',
                                       background: 'var(--bg3)', border: '1px solid var(--border)',
                                       borderRadius: 4, color: 'var(--text2)' }}>{c}</span>
              ))}
            </div>
          )}

          {/* Dates */}
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>
            {cve.published     && <span>Published: {new Date(cve.published).toLocaleDateString()} · </span>}
            {cve.last_modified && <span>Updated: {new Date(cve.last_modified).toLocaleDateString()}</span>}
          </div>

          {/* References */}
          {(patchRefs.length > 0 || vendorRefs.length > 0 || otherRefs.length > 0) && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>References</div>
              {[
                { label: 'Patches', items: patchRefs,  color: 'var(--low)' },
                { label: 'Vendor Advisories', items: vendorRefs, color: 'var(--info)' },
                { label: 'Other', items: otherRefs,    color: 'var(--text3)' },
              ].map(({ label, items, color }) => items.length > 0 && (
                <div key={label} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color, fontWeight: 600, marginBottom: 3 }}>{label}</div>
                  {items.slice(0, 5).map((r, i) => (
                    <div key={i} style={{ fontSize: 11, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <a href={r.url} target="_blank" rel="noopener noreferrer"
                         style={{ color: 'var(--info)' }}>
                        {r.url.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  ))}
                  {items.length > 5 && <div style={{ fontSize: 11, color: 'var(--text3)' }}>+{items.length - 5} more</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ApprovalWorkflow({ vuln }) {
  const { user } = useContext(AuthContext);
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requestModal, setRequestModal] = useState(false);

  const load = () => {
    api.get('/approvals').then(r => {
      setApprovals(r.data.filter(a => a.vuln_id === vuln.id));
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [vuln.id]);

  const statusColor = s => ({ pending: 'var(--medium)', approved: 'var(--low)', rejected: 'var(--critical)' }[s] || 'var(--text3)');
  const actionLabel = a => ({ accept_risk: 'Accept Risk', close: 'Close (Resolved)', mitigate: 'Mitigate' }[a] || a);

  const showWorkflow = ['open','in_progress'].includes(vuln.status);

  if (!showWorkflow) return null;

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Approval Workflow
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setRequestModal(true)}>
          + Request Approval
        </button>
      </div>

      {loading ? (
        <div className="spinner" style={{ margin: '8px auto', width: 20, height: 20 }} />
      ) : approvals.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>No approval requests for this vulnerability.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {approvals.map(a => (
            <div key={a.id} style={{ padding: '8px 10px', background: 'var(--bg3)', borderRadius: 'var(--radius)', borderLeft: `3px solid ${statusColor(a.status)}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{actionLabel(a.action)}</span>
                <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, background: statusColor(a.status), color: '#fff', fontWeight: 600 }}>
                  {a.status}
                </span>
                {a.approved_by_name && (
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>by {a.approved_by_name}</span>
                )}
              </div>
              {a.request_notes && (
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 2 }}>{a.request_notes}</div>
              )}
              {a.review_notes && (
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>Review: {a.review_notes}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {requestModal && (
        <RequestApprovalModal
          vulnId={vuln.id}
          onClose={() => setRequestModal(false)}
          onSubmitted={() => { setRequestModal(false); load(); }}
        />
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

          {/* CVE Panel */}
          {vuln.cve_id && <CVEPanel cveId={vuln.cve_id} />}

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

          {/* Approval Workflow */}
          <ApprovalWorkflow vuln={vuln} />
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
  const [vulns,      setVulns]      = useState([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [search,     setSearch]     = useState('');
  const [severity,   setSev]        = useState('');
  const [status,     setStatus]     = useState('open');
  const [selected,   setSelected]   = useState(null);
  const [addModal,   setAddModal]   = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [enriching,  setEnriching]  = useState(false);
  const [enrichResult, setEnrichResult] = useState(null);

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
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {enrichResult && (
            <span style={{ fontSize:12, color:'var(--low)' }}>
              ✓ Enriched {enrichResult.enriched}/{enrichResult.total} CVEs
            </span>
          )}
          <button
            className="btn btn-secondary"
            disabled={enriching}
            title="Fetch CVSS scores from NVD for all vulnerabilities that have a CVE ID"
            onClick={async () => {
              setEnriching(true); setEnrichResult(null);
              try {
                const r = await api.post('/cve/enrich-all');
                setEnrichResult(r.data);
                load();
              } catch(e) { alert('Enrichment failed: ' + (e.response?.data?.error || e.message)); }
              finally { setEnriching(false); }
            }}
          >
            {enriching ? 'Enriching…' : '⬇ Enrich CVEs'}
          </button>
          <button className="btn btn-primary" onClick={() => setAddModal(true)}>+ Add Vulnerability</button>
        </div>
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
