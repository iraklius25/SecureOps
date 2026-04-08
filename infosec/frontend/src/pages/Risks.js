// Risks.js
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../App';

const TREAT = ['mitigate','accept','transfer','avoid'];

export function Risks() {
  const [risks, setRisks] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ title:'', description:'', category:'', likelihood:3, impact:3, treatment:'mitigate' });
  const [loading, setLoading] = useState(true);
  const set = k => e => setForm(p=>({...p,[k]:e.target.value}));

  const load = useCallback(() => {
    api.get('/risks').then(r => { setRisks(r.data); setLoading(false); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async e => {
    e.preventDefault();
    await api.post('/risks', form);
    setModal(false); load();
  };
  const update = async (id, patch) => { await api.patch(`/risks/${id}`, patch); load(); };

  const scoreColor = s => s >= 20 ? 'risk-critical' : s >= 12 ? 'risk-high' : s >= 6 ? 'risk-medium' : 'risk-low';

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Risk Register</div><div className="page-subtitle">{risks.filter(r=>r.status==='open').length} open risks</div></div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Add Risk</button>
      </div>

      <div className="card" style={{padding:0}}>
        <div className="table-wrap">
          {loading ? <div className="empty-state"><div className="spinner"/></div> :
          risks.length === 0 ? <div className="empty-state"><div className="empty-icon">📋</div><p>No risks registered</p></div> :
          <table>
            <thead><tr><th>Score</th><th>Risk</th><th>Category</th><th>L</th><th>I</th><th>Level</th><th>Treatment</th><th>Asset</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {risks.map(r => (
                <tr key={r.id}>
                  <td><div className={`risk-score ${scoreColor(r.risk_score)}`}>{r.risk_score}</div></td>
                  <td style={{maxWidth:260}}>
                    <div style={{fontWeight:500}}>{r.title}</div>
                    {r.description && <div style={{fontSize:11,color:'var(--text3)'}}>{r.description.slice(0,60)}...</div>}
                  </td>
                  <td className="text-muted">{r.category || '—'}</td>
                  <td className="mono">{r.likelihood}</td>
                  <td className="mono">{r.impact}</td>
                  <td><span className={`badge badge-${r.risk_level}`}>{r.risk_level}</span></td>
                  <td>
                    <select value={r.treatment} onChange={e=>update(r.id,{treatment:e.target.value})}
                      style={{background:'var(--bg3)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:'var(--radius)',padding:'3px 6px',fontSize:12,fontFamily:'inherit'}}>
                      {TREAT.map(t=><option key={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="mono" style={{color:'var(--info)',fontSize:12}}>{r.ip_address || '—'}</td>
                  <td>
                    <select value={r.status||'open'} onChange={e=>update(r.id,{status:e.target.value})}
                      style={{background:'var(--bg3)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:'var(--radius)',padding:'3px 6px',fontSize:12,fontFamily:'inherit'}}>
                      {['open','in_progress','closed'].map(s=><option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table>}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal">
            <div className="modal-header"><h2>Add Risk</h2><button className="modal-close" onClick={()=>setModal(false)}>✕</button></div>
            <form onSubmit={submit}>
              <div className="modal-body">
                <div className="form-group"><label>Title *</label><input value={form.title} onChange={set('title')} required /></div>
                <div className="form-group"><label>Category</label><input value={form.category} onChange={set('category')} placeholder="Technical, Operational, Compliance..." /></div>
                <div className="form-group"><label>Description</label><textarea value={form.description} onChange={set('description')} rows={2} /></div>
                <div className="form-row">
                  <div className="form-group"><label>Likelihood (1–5)</label><input type="number" min="1" max="5" value={form.likelihood} onChange={set('likelihood')} /></div>
                  <div className="form-group"><label>Impact (1–5)</label><input type="number" min="1" max="5" value={form.impact} onChange={set('impact')} /></div>
                </div>
                <div style={{background:'var(--bg3)',padding:'8px 12px',borderRadius:'var(--radius)',fontSize:13,marginBottom:12}}>
                  Risk Score: <strong>{form.likelihood * form.impact}</strong> / 25
                </div>
                <div className="form-group"><label>Treatment</label><select value={form.treatment} onChange={set('treatment')}>{TREAT.map(t=><option key={t}>{t}</option>)}</select></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Risk</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Risks;
