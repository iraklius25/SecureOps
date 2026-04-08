import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../App';

const TYPES = ['unknown','server','workstation','network_device','iot','cloud','mobile'];
const CRIT  = ['critical','high','medium','low'];
const STATUS = ['active','inactive','decommissioned','unknown'];

function AssetModal({ asset, onClose, onSaved }) {
  const [form, setForm] = useState(asset || { ip_address:'', hostname:'', asset_type:'unknown', criticality:'medium', department:'', owner:'', location:'', asset_value:50000, notes:'', status:'active' });
  const [err, setErr] = useState('');
  const set = k => e => setForm(p => ({...p, [k]: e.target.value}));
  const submit = async e => {
    e.preventDefault(); setErr('');
    try {
      if (asset?.id) await api.put(`/assets/${asset.id}`, form);
      else await api.post('/assets', form);
      onSaved();
    } catch(ex) { setErr(ex.response?.data?.error || 'Error'); }
  };
  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{asset?.id ? 'Edit Asset' : 'Add Asset'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {err && <div className="alert alert-error">{err}</div>}
            <div className="form-row">
              <div className="form-group"><label>IP Address *</label><input value={form.ip_address} onChange={set('ip_address')} required placeholder="192.168.1.1" /></div>
              <div className="form-group"><label>Hostname</label><input value={form.hostname||''} onChange={set('hostname')} placeholder="server01.local" /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Asset Type</label><select value={form.asset_type} onChange={set('asset_type')}>{TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
              <div className="form-group"><label>Criticality</label><select value={form.criticality} onChange={set('criticality')}>{CRIT.map(c=><option key={c}>{c}</option>)}</select></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Department</label><input value={form.department||''} onChange={set('department')} placeholder="IT, Finance..." /></div>
              <div className="form-group"><label>Owner</label><input value={form.owner||''} onChange={set('owner')} placeholder="John Smith" /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Asset Value ($)</label><input type="number" value={form.asset_value} onChange={set('asset_value')} /></div>
              <div className="form-group"><label>Status</label><select value={form.status} onChange={set('status')}>{STATUS.map(s=><option key={s}>{s}</option>)}</select></div>
            </div>
            <div className="form-group"><label>Location</label><input value={form.location||''} onChange={set('location')} placeholder="DC-1 Rack A3" /></div>
            <div className="form-group"><label>Notes</label><textarea value={form.notes||''} onChange={set('notes')} rows={2} /></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Assets() {
  const [assets, setAssets] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [criticality, setCrit] = useState('');
  const [status, setStatus] = useState('active');
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/assets', { params: { page, limit: 50, search, criticality, status } })
      .then(r => { setAssets(r.data.data); setTotal(r.data.total); })
      .finally(() => setLoading(false));
  }, [page, search, criticality, status]);

  useEffect(() => { load(); }, [load]);

  const critColor = { critical:'var(--critical)', high:'var(--high)', medium:'var(--medium)', low:'var(--low)' };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Asset Inventory</div><div className="page-subtitle">{total} assets discovered</div></div>
        <button className="btn btn-primary" onClick={() => setModal({})}>+ Add Asset</button>
      </div>

      <div className="filter-bar">
        <input className="search-input" placeholder="Search IP, hostname, OS..." value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} />
        <select className="filter-select" value={criticality} onChange={e=>{setCrit(e.target.value);setPage(1);}}>
          <option value="">All criticality</option>{CRIT.map(c=><option key={c}>{c}</option>)}
        </select>
        <select className="filter-select" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}>
          <option value="">All status</option>{STATUS.map(s=><option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="card" style={{padding:0}}>
        <div className="table-wrap">
          {loading ? <div className="empty-state"><div className="spinner"/></div> :
          assets.length === 0 ? <div className="empty-state"><div className="empty-icon">🖥</div><p>No assets found</p></div> :
          <table>
            <thead><tr>
              <th>IP Address</th><th>Hostname</th><th>OS</th><th>Type</th>
              <th>Criticality</th><th>Open Ports</th><th>Vulns</th><th>Critical</th>
              <th>Last Seen</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {assets.map(a => (
                <tr key={a.id}>
                  <td className="mono" style={{color:'var(--info)'}}>{a.ip_address}</td>
                  <td className="mono">{a.hostname || <span className="text-dim">—</span>}</td>
                  <td className="text-muted">{a.os_name ? a.os_name.slice(0,30) : '—'}</td>
                  <td><span className="badge badge-info">{a.asset_type}</span></td>
                  <td><span style={{color:critColor[a.criticality],fontWeight:600,fontSize:12}}>{a.criticality}</span></td>
                  <td className="mono">{a.open_ports || 0}</td>
                  <td>
                    {a.open_vulns > 0
                      ? <span style={{color:'var(--high)',fontWeight:600}}>{a.open_vulns}</span>
                      : <span className="text-dim">0</span>}
                  </td>
                  <td>
                    {a.critical_vulns > 0
                      ? <span style={{color:'var(--critical)',fontWeight:700}}>{a.critical_vulns}</span>
                      : <span className="text-dim">0</span>}
                  </td>
                  <td className="text-dim">{a.last_seen ? new Date(a.last_seen).toLocaleDateString() : '—'}</td>
                  <td><span className={`status-dot dot-${a.status === 'active' ? 'completed' : 'pending'}`}/>{a.status}</td>
                  <td><button className="btn btn-secondary btn-sm" onClick={() => setModal(a)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>}
        </div>
      </div>

      <div className="pagination">
        <span className="page-info">{total} total</span>
        {Array.from({length: Math.ceil(total/50)}, (_,i) => i+1).map(p => (
          <button key={p} className={`page-btn ${p===page?'active':''}`} onClick={() => setPage(p)}>{p}</button>
        ))}
      </div>

      {modal !== null && <AssetModal asset={modal?.id ? modal : null} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </div>
  );
}
