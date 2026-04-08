import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../App';
import { format } from 'date-fns';

const SEVS = ['critical','high','medium','low','informational'];
const STATUSES = ['open','in_progress','mitigated','accepted','false_positive','closed'];
const fmt$ = n => n == null ? '—' : '$' + parseFloat(n).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0});

function VulnDetail({ vuln, onClose, onUpdated }) {
  const [status, setStatus] = useState(vuln.status);
  const [av, setAv] = useState(vuln.asset_value || 50000);
  const [ef, setEf] = useState(vuln.exposure_factor || 30);
  const [aro, setAro] = useState(vuln.aro || 0.25);
  const [saving, setSaving] = useState(false);
  const sle = av * ef / 100;
  const ale = sle * aro;

  const save = async () => {
    setSaving(true);
    await api.patch(`/vulns/${vuln.id}`, { status, asset_value: av, exposure_factor: ef, aro });
    setSaving(false); onUpdated();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{maxWidth:680}}>
        <div className="modal-header">
          <h2>Vulnerability Detail</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{display:'flex',flexDirection:'column',gap:16}}>
          <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
            <span className={`badge badge-${vuln.severity}`}>{vuln.severity}</span>
            {vuln.cve_id && <a href={`https://nvd.nist.gov/vuln/detail/${vuln.cve_id}`} target="_blank" rel="noopener noreferrer" style={{color:'var(--info)',fontSize:12}}>{vuln.cve_id} ↗</a>}
            {vuln.cvss_score && <span style={{fontSize:12,color:'var(--text2)'}}>CVSS {vuln.cvss_score}</span>}
          </div>
          <div>
            <div style={{fontWeight:600,fontSize:15,marginBottom:6}}>{vuln.title}</div>
            <div style={{fontSize:13,color:'var(--text2)',lineHeight:1.6}}>{vuln.description}</div>
          </div>
          {vuln.evidence && (
            <div style={{background:'var(--bg3)',borderRadius:'var(--radius)',padding:'10px 12px',fontSize:12,fontFamily:'monospace',color:'var(--text2)',wordBreak:'break-all'}}>
              <div style={{color:'var(--text3)',marginBottom:4,fontSize:11}}>EVIDENCE</div>{vuln.evidence}
            </div>
          )}
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
                <input type="number" value={av} onChange={e=>setAv(parseFloat(e.target.value)||0)} />
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <label>Exposure Factor (%)</label>
                <input type="number" value={ef} onChange={e=>setEf(parseFloat(e.target.value)||0)} min="0" max="100" />
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <label>ARO (events/yr)</label>
                <input type="number" value={aro} onChange={e=>setAro(parseFloat(e.target.value)||0)} step="0.01" />
              </div>
            </div>
            <div style={{display:'flex',gap:20,fontSize:13}}>
              <span style={{color:'var(--text2)'}}>SLE: <strong style={{color:'var(--text)',fontFamily:'monospace'}}>{fmt$(sle)}</strong></span>
              <span style={{color:'var(--text2)'}}>ALE: <strong style={{color: ale > 50000 ? 'var(--critical)' : ale > 10000 ? 'var(--high)' : 'var(--medium)',fontFamily:'monospace'}}>{fmt$(ale)}</strong></span>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div className="form-group" style={{marginBottom:0,flex:1}}>
              <label>Status</label>
              <select value={status} onChange={e=>setStatus(e.target.value)}>
                {STATUSES.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            {vuln.ip_address && <div style={{fontSize:13,color:'var(--text2)'}}>Asset: <span className="mono" style={{color:'var(--info)'}}>{vuln.ip_address}</span>{vuln.hostname && ` (${vuln.hostname})`}</div>}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Vulnerabilities() {
  const [vulns, setVulns] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [severity, setSev] = useState('');
  const [status, setStatus] = useState('open');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

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
              <th>Asset</th><th>ALE</th><th>Status</th><th>Detected</th>
            </tr></thead>
            <tbody>
              {vulns.map(v => (
                <tr key={v.id} style={{cursor:'pointer'}} onClick={() => setSelected(v)}>
                  <td><span className={`badge badge-${v.severity}`}>{v.severity}</span></td>
                  <td style={{maxWidth:280}}>
                    <div style={{fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.title}</div>
                    <div style={{fontSize:11,color:'var(--text3)'}}>{v.vuln_type}</div>
                  </td>
                  <td className="mono">{v.cve_id || <span className="text-dim">—</span>}</td>
                  <td className="mono">{v.cvss_score || <span className="text-dim">—</span>}</td>
                  <td className="mono" style={{color:'var(--info)'}}>{v.ip_address}{v.hostname && <><br/><span style={{fontSize:11,color:'var(--text3)'}}>{v.hostname}</span></>}</td>
                  <td className={`ale-value ${v.ale > 50000 ? 'ale-high' : v.ale > 10000 ? 'ale-med' : 'ale-low'}`}>
                    {v.ale ? '$'+parseFloat(v.ale).toLocaleString('en-US',{maximumFractionDigits:0}) : '—'}
                  </td>
                  <td><span className={`badge badge-${v.status}`}>{v.status}</span></td>
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
    </div>
  );
}
