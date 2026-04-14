import React, { useState, useEffect, useCallback, useContext } from 'react';
import { api, AuthContext } from '../App';
import { format } from 'date-fns';

const TYPES  = ['unknown','server','workstation','network_device','iot','cloud','mobile'];
const CRIT   = ['critical','high','medium','low'];
const STATUS = ['active','inactive','decommissioned','unknown'];

const CHANGE_ICONS = {
  port_added:      { icon: '➕', color: 'var(--low)' },
  port_removed:    { icon: '➖', color: 'var(--critical)' },
  service_changed: { icon: '🔄', color: 'var(--medium)' },
  os_changed:      { icon: '💻', color: 'var(--info)' },
  first_seen:      { icon: '🆕', color: 'var(--low)' },
};

function AssetHistoryModal({ asset, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/assets/${asset.id}/history`)
      .then(r => setHistory(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [asset.id]);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 700 }}>
        <div className="modal-header">
          <div>
            <h2>Change History</h2>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{asset.ip_address}{asset.hostname ? ` — ${asset.hostname}` : ''}</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="empty-state"><div className="spinner" /></div>
          ) : history.length === 0 ? (
            <div className="empty-state"><p>No change history recorded yet.</p></div>
          ) : (
            <table>
              <thead>
                <tr><th>Time</th><th>Change</th><th>Field</th><th>Before</th><th>After</th><th>Scan</th></tr>
              </thead>
              <tbody>
                {history.map(h => {
                  const meta = CHANGE_ICONS[h.change_type] || { icon: '•', color: 'var(--text2)' };
                  return (
                    <tr key={h.id}>
                      <td className="mono text-dim" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                        {format(new Date(h.created_at), 'MMM d HH:mm')}
                      </td>
                      <td>
                        <span style={{ color: meta.color, fontWeight: 500, fontSize: 12 }}>
                          {meta.icon} {h.change_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="text-dim" style={{ fontSize: 12 }}>{h.field || '—'}</td>
                      <td className="mono" style={{ fontSize: 11, color: 'var(--critical)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {h.old_value || '—'}
                      </td>
                      <td className="mono" style={{ fontSize: 11, color: 'var(--low)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {h.new_value || '—'}
                      </td>
                      <td className="text-dim" style={{ fontSize: 11 }}>{h.scan_name || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function TagInput({ value = [], onChange }) {
  const [input, setInput] = useState('');
  const tags = Array.isArray(value) ? value : [];

  const add = () => {
    const t = input.trim();
    if (t && !tags.includes(t)) { onChange([...tags, t]); }
    setInput('');
  };

  const remove = tag => onChange(tags.filter(t => t !== tag));

  return (
    <div style={{ border: '1px solid var(--border2)', borderRadius: 'var(--radius)', padding: '6px 8px', background: 'var(--bg3)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: tags.length ? 6 : 0 }}>
        {tags.map(t => (
          <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--accent)', color: 'var(--accent-fg, #fff)',
                                  borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 500 }}>
            {t}
            <button type="button" onClick={() => remove(t)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1, fontSize: 12 }}>✕</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Add tag, press Enter" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text)' }} />
        <button type="button" onClick={add} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-h)', fontSize: 12 }}>+ Add</button>
      </div>
    </div>
  );
}

function AssetModal({ asset, onClose, onSaved }) {
  const [form, setForm] = useState(asset || {
    ip_address: '', hostname: '', asset_type: 'unknown', criticality: 'medium',
    department: '', owner: '', location: '', asset_value: 50000, notes: '', status: 'active', tags: [],
  });
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
            <div className="form-group">
              <label>Tags</label>
              <TagInput value={form.tags || []} onChange={tags => setForm(p => ({ ...p, tags }))} />
            </div>
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
  const { user } = useContext(AuthContext);
  const isAdmin  = user?.role === 'admin';
  const canEdit  = ['admin','analyst'].includes(user?.role);
  const [assets,   setAssets]   = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [search,   setSearch]   = useState('');
  const [criticality, setCrit]  = useState('');
  const [status,   setStatus]   = useState('active');
  const [modal,    setModal]    = useState(null);
  const [histAsset,setHistAsset]= useState(null);
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/assets', { params: { page, limit: 50, search, criticality, status } })
      .then(r => { setAssets(r.data.data); setTotal(r.data.total); })
      .finally(() => setLoading(false));
  }, [page, search, criticality, status]);

  useEffect(() => { load(); }, [load]);

  const deleteAsset = async id => {
    if (!window.confirm('Permanently delete this asset and all its vulnerabilities, ports, and risks? This cannot be undone.')) return;
    try { await api.delete(`/assets/${id}`); load(); }
    catch(ex) { alert(ex.response?.data?.error || 'Delete failed'); }
  };

  const critColor = { critical:'var(--critical)', high:'var(--high)', medium:'var(--medium)', low:'var(--low)' };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Asset Inventory</div><div className="page-subtitle">{total} assets discovered</div></div>
        {canEdit && <button className="btn btn-primary" onClick={() => setModal({})}>+ Add Asset</button>}
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
              <th>Criticality</th><th>Tags</th><th>Open Ports</th><th>Vulns</th><th>Critical</th>
              <th>Last Seen</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {assets.map(a => (
                <tr key={a.id}>
                  <td className="mono" style={{color:'var(--info)'}}>{a.ip_address}</td>
                  <td className="mono">{a.hostname || <span className="text-dim">—</span>}</td>
                  <td className="text-muted">{a.os_name ? a.os_name.slice(0,28) : '—'}</td>
                  <td><span className="badge badge-info">{a.asset_type}</span></td>
                  <td><span style={{color:critColor[a.criticality],fontWeight:600,fontSize:12}}>{a.criticality}</span></td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                      {(a.tags || []).slice(0, 3).map(t => (
                        <span key={t} style={{ fontSize: 10, padding: '1px 5px', background: 'var(--bg3)', borderRadius: 3, color: 'var(--text2)' }}>{t}</span>
                      ))}
                      {(a.tags || []).length > 3 && <span style={{ fontSize: 10, color: 'var(--text3)' }}>+{a.tags.length - 3}</span>}
                    </div>
                  </td>
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
                  <td style={{display:'flex',gap:4}}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setHistAsset(a)} title="Change history">📜</button>
                    {canEdit && <button className="btn btn-secondary btn-sm" onClick={() => setModal(a)}>Edit</button>}
                    {isAdmin && <button className="btn btn-danger btn-sm" onClick={() => deleteAsset(a.id)}>Del</button>}
                  </td>
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
      {histAsset && <AssetHistoryModal asset={histAsset} onClose={() => setHistAsset(null)} />}
    </div>
  );
}
