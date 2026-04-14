import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../App';
import { format } from 'date-fns';

const SCAN_PROFILES = [
  { label: 'Quick',      desc: 'Fast port scan, no OS detection',   scan_type: 'service',       timing: 'T4', technique: '',    no_ping: false, fragment: false, nmapHint: '-T4 (fast, common ports)' },
  { label: 'Full',       desc: 'Full service + vulnerability scan', scan_type: 'full',          timing: 'T4', technique: '',    no_ping: false, fragment: false, nmapHint: '-T4 -sV -sC -O' },
  { label: 'Stealth',    desc: 'SYN stealth, slow timing, evasion', scan_type: 'full',          timing: 'T2', technique: '-sS', no_ping: false, fragment: true,  nmapHint: '-T2 -sS -f' },
  { label: 'Compliance', desc: 'Version + banner grab for audits',  scan_type: 'vulnerability', timing: 'T3', technique: '-sT', no_ping: true,  fragment: false, nmapHint: '-T3 -sT -Pn' },
];

function NewScanModal({ onClose, onStarted }) {
  const [form, setForm] = useState({ target: '', scan_type: 'full', name: '', timing: 'T4', technique: '', no_ping: false, fragment: false });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(p => ({...p, [k]: e.target.value}));
  const toggle = k => () => setForm(p => ({...p, [k]: !p[k]}));

  const applyProfile = p => setForm(f => ({ ...f, scan_type: p.scan_type, timing: p.timing, technique: p.technique, no_ping: p.no_ping, fragment: p.fragment }));

  const submit = async e => {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      const nmapArgs = [
        `-${form.timing}`,
        form.technique || '',
        form.no_ping ? '-Pn' : '',
        form.fragment ? '-f' : '',
      ].filter(Boolean).join(' ');
      await api.post('/scans', { target: form.target, scan_type: form.scan_type, name: form.name, nmapArgs });
      onStarted();
    } catch(ex) { setErr(ex.response?.data?.error || 'Failed to start scan'); }
    finally { setLoading(false); }
  };

  const timingDesc = { T0:'Paranoid — very slow, evades most IDS', T1:'Sneaky — slow, low IDS risk', T2:'Polite — reduced bandwidth', T3:'Normal — default nmap speed', T4:'Aggressive — fast (default)', T5:'Insane — fastest, easily detected' };

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 600 }}>
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

            {/* Scan Profiles */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Scan Profile</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {SCAN_PROFILES.map(p => (
                  <button key={p.label} type="button" onClick={() => applyProfile(p)}
                    style={{ padding: '6px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border2)',
                             background: form.scan_type === p.scan_type && form.timing === p.timing ? 'var(--accent)' : 'var(--bg3)',
                             color: form.scan_type === p.scan_type && form.timing === p.timing ? '#fff' : 'var(--text)',
                             cursor: 'pointer', fontSize: 12 }}
                    title={p.desc}>
                    {p.label}
                    <div style={{ fontSize: 10, color: form.scan_type === p.scan_type && form.timing === p.timing ? 'rgba(255,255,255,0.7)' : 'var(--text3)' }}>
                      {p.nmapHint}
                    </div>
                  </button>
                ))}
              </div>
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

            <div style={{borderTop:'1px solid var(--border)', paddingTop:14, marginTop:4}}>
              <div style={{fontSize:12, fontWeight:600, color:'var(--text2)', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.05em'}}>Nmap Options</div>
              <div className="form-row">
                <div className="form-group">
                  <label>Timing / Speed</label>
                  <select value={form.timing} onChange={set('timing')}>
                    <option value="T0">T0 — Paranoid (slowest, stealthiest)</option>
                    <option value="T1">T1 — Sneaky</option>
                    <option value="T2">T2 — Polite</option>
                    <option value="T3">T3 — Normal</option>
                    <option value="T4">T4 — Aggressive (default)</option>
                    <option value="T5">T5 — Insane (fastest)</option>
                  </select>
                  <div style={{fontSize:11, color:'var(--text3)', marginTop:4}}>{timingDesc[form.timing]}</div>
                </div>
                <div className="form-group">
                  <label>Scan Technique</label>
                  <select value={form.technique} onChange={set('technique')}>
                    <option value="">Default (nmap decides)</option>
                    <option value="-sS">SYN Stealth (-sS) — half-open, less logged</option>
                    <option value="-sT">TCP Connect (-sT) — full connection</option>
                    <option value="-sA">ACK Scan (-sA) — firewall mapping</option>
                    <option value="-sN">NULL Scan (-sN) — evades some firewalls</option>
                    <option value="-sF">FIN Scan (-sF) — evades some firewalls</option>
                    <option value="-sX">Xmas Scan (-sX) — evades some firewalls</option>
                  </select>
                </div>
              </div>
              <div style={{display:'flex', gap:20, marginTop:4}}>
                <label style={{display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer'}}>
                  <input type="checkbox" checked={form.no_ping} onChange={toggle('no_ping')} />
                  <span>Skip host discovery <span style={{color:'var(--text3)'}}>(-Pn)</span></span>
                </label>
                <label style={{display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer'}}>
                  <input type="checkbox" checked={form.fragment} onChange={toggle('fragment')} />
                  <span>Fragment packets <span style={{color:'var(--text3)'}}>(-f)</span></span>
                </label>
              </div>
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

function ScanResultsModal({ scan, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/scans/${scan.id}/results`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [scan.id]);

  const severityColor = { critical: 'var(--critical)', high: 'var(--high)', medium: 'var(--medium)', low: 'var(--low)' };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 860 }}>
        <div className="modal-header">
          <div>
            <h2>Scan Results — {scan.target}</h2>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              {scan.assets_found ?? 0} assets · {scan.vulns_found ?? 0} vulnerabilities found
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="empty-state"><div className="spinner" /></div>
          ) : !data?.assets?.length ? (
            <div className="empty-state"><p>No port data found for this scan.</p></div>
          ) : (
            data.assets.map(asset => (
              <div key={asset.id} style={{ borderBottom: '1px solid var(--border)', padding: '14px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <span className="mono" style={{ color: 'var(--info)', fontWeight: 600 }}>{asset.ip_address}</span>
                  {asset.hostname && <span style={{ color: 'var(--text2)', fontSize: 13 }}>{asset.hostname}</span>}
                  {asset.os_name && <span style={{ color: 'var(--text3)', fontSize: 12 }}>{asset.os_name}</span>}
                  <span style={{ color: severityColor[asset.criticality] || 'var(--text3)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{asset.criticality}</span>
                </div>
                {asset.ports?.length ? (
                  <table style={{ width: '100%', fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 80 }}>Port</th>
                        <th style={{ width: 60 }}>Proto</th>
                        <th style={{ width: 100 }}>Service</th>
                        <th style={{ width: 160 }}>Product</th>
                        <th style={{ width: 100 }}>Version</th>
                        <th>Banner</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asset.ports.map((p, i) => (
                        <tr key={i}>
                          <td className="mono" style={{ color: 'var(--low)', fontWeight: 600 }}>{p.port}</td>
                          <td className="mono" style={{ color: 'var(--text3)' }}>{p.protocol}</td>
                          <td style={{ color: 'var(--info)' }}>{p.service || '—'}</td>
                          <td>{p.product || '—'}</td>
                          <td className="mono">{p.version || '—'}</td>
                          <td style={{ color: 'var(--text3)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={p.banner || ''}>{p.banner || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>No open ports recorded.</span>
                )}
              </div>
            ))
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function ScheduleModal({ onClose, onScheduled }) {
  const [form, setForm] = useState({ target: '', scan_type: 'full', name: '', timing: 'T4', technique: '', no_ping: false, scheduledAt: '', stopAfterMinutes: '' });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(p => ({...p, [k]: e.target.value}));
  const toggle = k => () => setForm(p => ({...p, [k]: !p[k]}));

  const submit = async e => {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      const nmapArgs = [`-${form.timing}`, form.technique, form.no_ping ? '-Pn' : ''].filter(Boolean).join(' ');
      await api.post('/scans', {
        target: form.target, scan_type: form.scan_type, name: form.name,
        nmapArgs, scheduledAt: form.scheduledAt,
        stopAfterMinutes: form.stopAfterMinutes ? parseInt(form.stopAfterMinutes) : undefined,
      });
      onScheduled();
    } catch(ex) { setErr(ex.response?.data?.error || 'Failed to schedule scan'); }
    finally { setLoading(false); }
  };

  // min datetime = now + 1 minute
  const minDt = new Date(Date.now() + 60000).toISOString().slice(0,16);

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h2>Schedule Scan</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {err && <div className="alert alert-error">{err}</div>}
            <div className="form-group">
              <label>Target *</label>
              <input value={form.target} onChange={set('target')} required placeholder="192.168.1.1  or  192.168.1.0/24" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Start at *</label>
                <input type="datetime-local" value={form.scheduledAt} onChange={set('scheduledAt')} required min={minDt} />
              </div>
              <div className="form-group">
                <label>Auto-stop after</label>
                <select value={form.stopAfterMinutes} onChange={set('stopAfterMinutes')}>
                  <option value="">No auto-stop</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="120">2 hours</option>
                  <option value="240">4 hours</option>
                  <option value="480">8 hours</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Scan type</label>
                <select value={form.scan_type} onChange={set('scan_type')}>
                  <option value="ping">Ping sweep</option>
                  <option value="port">Port discovery</option>
                  <option value="service">Service detection</option>
                  <option value="vulnerability">Vulnerability check</option>
                  <option value="full">Full scan</option>
                </select>
              </div>
              <div className="form-group">
                <label>Timing</label>
                <select value={form.timing} onChange={set('timing')}>
                  <option value="T0">T0 — Paranoid</option>
                  <option value="T1">T1 — Sneaky</option>
                  <option value="T2">T2 — Polite</option>
                  <option value="T3">T3 — Normal</option>
                  <option value="T4">T4 — Aggressive</option>
                  <option value="T5">T5 — Insane</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Technique</label>
                <select value={form.technique} onChange={set('technique')}>
                  <option value="">Default</option>
                  <option value="-sS">SYN Stealth (-sS)</option>
                  <option value="-sT">TCP Connect (-sT)</option>
                  <option value="-sN">NULL Scan (-sN)</option>
                  <option value="-sF">FIN Scan (-sF)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Scan name (optional)</label>
                <input value={form.name} onChange={set('name')} placeholder="Nightly sweep" />
              </div>
            </div>
            <label style={{display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer', marginTop:4}}>
              <input type="checkbox" checked={form.no_ping} onChange={toggle('no_ping')} />
              Skip host discovery (-Pn)
            </label>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Scheduling...' : '🕐 Schedule Scan'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Scans() {
  const [scans, setScans] = useState([]);
  const [modal, setModal] = useState(false);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [resultsModal, setResultsModal] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    api.get('/scans').then(r => { setScans(r.data); setLoading(false); });
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const remove = async id => {
    await api.delete(`/scans/${id}`);
    load();
  };

  const dur = (start, end) => {
    if (!start) return '-';
    const ms = new Date(end||Date.now()) - new Date(start);
    const s = Math.floor(ms/1000);
    return s < 60 ? `${s}s` : `${Math.floor(s/60)}m ${s%60}s`;
  };

  const isScheduled = s => s.status === 'pending' && s.scan_options?.scheduled_at;

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Network Scans</div><div className="page-subtitle">Discover assets and detect vulnerabilities</div></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setScheduleModal(true)}>🕐 Schedule</button>
          <button className="btn btn-primary" onClick={() => setModal(true)}>+ New Scan</button>
        </div>
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
                <th>Assets</th><th>Vulns Found</th><th>Duration</th><th>Started / Scheduled</th><th></th>
              </tr></thead>
              <tbody>
                {scans.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div className="mono" style={{color:'var(--info)'}}>{s.target}</div>
                      {s.name && <div style={{fontSize:11,color:'var(--text3)'}}>{s.name}</div>}
                    </td>
                    <td>{s.scan_type}</td>
                    <td>
                      {isScheduled(s) ? (
                        <span style={{color:'var(--medium)',fontSize:12}}>🕐 scheduled</span>
                      ) : (
                        <><span className={`status-dot dot-${s.status}`}/>{s.status}</>
                      )}
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
                    <td className="text-dim">
                      {isScheduled(s)
                        ? format(new Date(s.scan_options.scheduled_at), 'MMM d HH:mm')
                        : (s.started_at ? format(new Date(s.started_at),'MMM d HH:mm') : (s.created_at ? format(new Date(s.created_at),'MMM d HH:mm') : '-'))}
                      {s.scan_options?.stop_at && (
                        <div style={{fontSize:10,color:'var(--text3)'}}>stops {format(new Date(s.scan_options.stop_at),'HH:mm')}</div>
                      )}
                    </td>
                    <td style={{ display: 'flex', gap: 4 }}>
                      {s.status === 'completed' &&
                        <button className="btn btn-secondary btn-sm" onClick={() => setResultsModal(s)}>View</button>}
                      {(s.status === 'running') &&
                        <button className="btn btn-danger btn-sm" onClick={() => remove(s.id)}>⏹ Stop</button>}
                      {(s.status === 'pending') &&
                        <button className="btn btn-danger btn-sm" onClick={() => remove(s.id)}>Cancel</button>}
                      {['completed','failed','cancelled'].includes(s.status) &&
                        <button className="btn btn-danger btn-sm" onClick={() => { if(window.confirm('Delete this scan record?')) remove(s.id); }}>Delete</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && <NewScanModal onClose={() => setModal(false)} onStarted={() => { setModal(false); load(); }} />}
      {scheduleModal && <ScheduleModal onClose={() => setScheduleModal(false)} onScheduled={() => { setScheduleModal(false); load(); }} />}
      {resultsModal && <ScanResultsModal scan={resultsModal} onClose={() => setResultsModal(null)} />}
    </div>
  );
}
