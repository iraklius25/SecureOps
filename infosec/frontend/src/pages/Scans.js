import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../App';
import { format } from 'date-fns';

function NewScanModal({ onClose, onStarted }) {
  const [form, setForm] = useState({ target: '', scan_type: 'full', name: '' });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const submit = async e => {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      await api.post('/scans', form);
      onStarted();
    } catch(ex) { setErr(ex.response?.data?.error || 'Failed to start scan'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>New Scan</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {err && <div className="alert alert-error">{err}</div>}
            <div className="alert alert-warning" style={{marginBottom:14}}>
              ⚠ Only scan networks you are authorised to test. Unauthorised scanning may be illegal.
            </div>
            <div className="form-group">
              <label>Target (IP, CIDR range, or IP range) *</label>
              <input value={form.target} onChange={set('target')} required
                placeholder="192.168.1.1  or  192.168.1.0/24  or  10.0.0.1-254" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Scan type</label>
                <select value={form.scan_type} onChange={set('scan_type')}>
                  <option value="ping">Ping sweep (fast)</option>
                  <option value="port">Port discovery</option>
                  <option value="service">Service detection</option>
                  <option value="vulnerability">Vulnerability check</option>
                  <option value="full">Full scan (recommended)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Scan name (optional)</label>
                <input value={form.name} onChange={set('name')} placeholder="Weekly DC scan" />
              </div>
            </div>
            <div style={{background:'var(--bg3)',borderRadius:'var(--radius)',padding:'10px 14px',fontSize:12,color:'var(--text2)'}}>
              <strong>What gets checked:</strong> open ports, service versions, SSH protocol versions, TLS/SSL strength, exposed databases, default credentials indicators, known CVE patterns, and 19 built-in vulnerability rules.
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Starting...' : '▶ Start Scan'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Scans() {
  const [scans, setScans] = useState([]);
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    api.get('/scans').then(r => { setScans(r.data); setLoading(false); });
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // poll every 5s for running scan updates
    return () => clearInterval(t);
  }, [load]);

  const cancel = async id => {
    await api.delete(`/scans/${id}`);
    load();
  };

  const dur = (start, end) => {
    if (!start) return '-';
    const ms = new Date(end||Date.now()) - new Date(start);
    const s = Math.floor(ms/1000);
    return s < 60 ? `${s}s` : `${Math.floor(s/60)}m ${s%60}s`;
  };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Network Scans</div><div className="page-subtitle">Discover assets and detect vulnerabilities</div></div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ New Scan</button>
      </div>

      <div className="card" style={{padding:0}}>
        <div className="table-wrap">
          {loading ? <div className="empty-state"><div className="spinner"/></div> :
          scans.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <p>No scans yet. Start your first scan to discover assets.</p>
            </div>
          ) : (
            <table>
              <thead><tr>
                <th>Target</th><th>Type</th><th>Status</th><th>Progress</th>
                <th>Assets</th><th>Vulns Found</th><th>Duration</th><th>Started</th><th></th>
              </tr></thead>
              <tbody>
                {scans.map(s => (
                  <tr key={s.id}>
                    <td className="mono" style={{color:'var(--info)'}}>{s.target}</td>
                    <td>{s.scan_type}</td>
                    <td>
                      <span className={`status-dot dot-${s.status}`}/>
                      {s.status}
                      {s.status === 'failed' && <span style={{color:'var(--critical)',fontSize:11,display:'block'}}>{s.error_message?.slice(0,40)}</span>}
                    </td>
                    <td style={{minWidth:100}}>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{width:`${s.progress||0}%`, background: s.status==='failed'?'var(--critical)':s.status==='completed'?'var(--low)':'var(--accent)'}}/>
                      </div>
                      <span style={{fontSize:11,color:'var(--text3)'}}>{s.progress||0}%</span>
                    </td>
                    <td>{s.assets_found ?? '-'}</td>
                    <td>
                      {s.vulns_found > 0
                        ? <span style={{color:'var(--high)',fontWeight:600}}>{s.vulns_found}</span>
                        : (s.status==='completed' ? <span className="text-dim">0</span> : '-')}
                    </td>
                    <td className="text-dim">{dur(s.started_at, s.completed_at)}</td>
                    <td className="text-dim">{s.created_at ? format(new Date(s.created_at),'MMM d HH:mm') : '-'}</td>
                    <td>
                      {s.status === 'pending' &&
                        <button className="btn btn-danger btn-sm" onClick={() => cancel(s.id)}>Cancel</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && <NewScanModal onClose={() => setModal(false)} onStarted={() => { setModal(false); load(); }} />}
    </div>
  );
}
