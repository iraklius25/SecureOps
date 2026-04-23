import React, { useState, useEffect, useCallback, useContext } from 'react';
import { api, AuthContext } from '../App';

function ScoreBar({ score }) {
  const color =
    score <= 25 ? '#28a745' :
    score <= 50 ? '#ffc107' :
    score <= 75 ? '#fd7e14' : '#dc3545';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 80, height: 8, background: 'var(--border2)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 28 }}>{score}</span>
    </div>
  );
}

function CheckIPModal({ onClose, onChecked }) {
  const [ip, setIp] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');

  const check = async e => {
    e.preventDefault();
    setErr(''); setResult(null); setLoading(true);
    try {
      const r = await api.post('/threat/check', { ip });
      setResult(r.data);
      onChecked();
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Check failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2>Check IP Address</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={check}>
          <div className="modal-body">
            {err && <div className="alert alert-error" style={{ marginBottom: 12 }}>{err}</div>}
            <div className="form-group">
              <label>IP Address</label>
              <input
                value={ip}
                onChange={e => setIp(e.target.value)}
                placeholder="e.g. 1.2.3.4"
                required
                pattern="^(\d{1,3}\.){3}\d{1,3}$"
                title="Enter a valid IPv4 address"
                autoFocus
              />
            </div>
            {result && (
              <div style={{ marginTop: 16, padding: 16, background: 'var(--bg3)', borderRadius: 'var(--radius)', border: `1px solid ${result.is_malicious ? 'var(--critical)' : 'var(--border)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, fontFamily: 'monospace' }}>{result.ip_address}</span>
                  {result.is_malicious
                    ? <span className="badge badge-critical">Malicious</span>
                    : <span className="badge badge-low">Clean</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                  <div><span style={{ color: 'var(--text3)' }}>Abuse Score: </span><strong>{result.abuse_score}/100</strong></div>
                  <div><span style={{ color: 'var(--text3)' }}>Country: </span><strong>{result.country_code || '—'}</strong></div>
                  <div><span style={{ color: 'var(--text3)' }}>ISP: </span><strong>{result.isp || '—'}</strong></div>
                  <div><span style={{ color: 'var(--text3)' }}>Reports: </span><strong>{result.total_reports}</strong></div>
                  {result.usage_type && <div style={{ gridColumn: '1/-1' }}><span style={{ color: 'var(--text3)' }}>Usage: </span><strong>{result.usage_type}</strong></div>}
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !ip}>
              {loading ? 'Checking...' : 'Check IP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ThreatIntel() {
  const { user } = useContext(AuthContext);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [checkModal, setCheckModal] = useState(false);
  const [msg, setMsg] = useState('');
  const canEdit = ['admin', 'analyst'].includes(user?.role);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/threat').then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const scanAll = async () => {
    if (!window.confirm('Check all active assets against AbuseIPDB? This may take a few minutes (1100ms between each call).')) return;
    setScanning(true);
    setMsg('');
    try {
      await api.post('/threat/scan-all');
      setMsg('Scan started in background. Results will appear as they are checked.');
      setTimeout(load, 5000);
    } catch (ex) {
      setMsg(ex.response?.data?.error || 'Scan failed');
    } finally { setScanning(false); }
  };

  const remove = async ip => {
    if (!window.confirm(`Remove ${ip} from threat intel cache?`)) return;
    await api.delete(`/threat/${encodeURIComponent(ip)}`);
    load();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Threat Intelligence</div>
          <div className="page-subtitle">AbuseIPDB reputation lookup for network assets</div>
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setCheckModal(true)}>
              🔍 Check Single IP
            </button>
            {user?.role === 'admin' && (
              <button className="btn btn-primary" onClick={scanAll} disabled={scanning}>
                {scanning ? 'Scanning...' : '🔄 Scan All Assets'}
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--text2)' }}>
        ℹ️ Requires <code style={{ fontFamily: 'monospace', background: 'var(--bg2)', padding: '1px 5px', borderRadius: 3 }}>ABUSEIPDB_API_KEY</code> in server <code style={{ fontFamily: 'monospace', background: 'var(--bg2)', padding: '1px 5px', borderRadius: 3 }}>.env</code>. Free tier: 1,000 checks/day.
      </div>

      {msg && (
        <div className={`alert ${msg.includes('failed') || msg.includes('error') ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: 16 }}>
          {msg}
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          {loading ? (
            <div className="empty-state"><div className="spinner" /></div>
          ) : data.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔥</div>
              <p>No threat intelligence data yet. Check an IP or scan all assets.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>IP Address</th>
                  <th>Abuse Score</th>
                  <th>Status</th>
                  <th>Country</th>
                  <th>ISP</th>
                  <th>Reports</th>
                  <th>Asset Hostname</th>
                  <th>Criticality</th>
                  <th>Last Checked</th>
                  {user?.role === 'admin' && <th></th>}
                </tr>
              </thead>
              <tbody>
                {data.map(row => (
                  <tr key={row.ip_address}>
                    <td className="mono" style={{ color: 'var(--info)', fontWeight: 600 }}>{row.ip_address}</td>
                    <td><ScoreBar score={row.abuse_score || 0} /></td>
                    <td>
                      {row.is_malicious
                        ? <span className="badge badge-critical">Malicious</span>
                        : <span className="badge badge-low">Clean</span>}
                    </td>
                    <td style={{ fontSize: 13 }}>{row.country_code || <span className="text-dim">—</span>}</td>
                    <td style={{ fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.isp || <span className="text-dim">—</span>}
                    </td>
                    <td className="mono">{row.total_reports ?? 0}</td>
                    <td style={{ fontSize: 13 }}>{row.hostname || <span className="text-dim">—</span>}</td>
                    <td>
                      {row.criticality
                        ? <span className={`badge badge-${row.criticality}`}>{row.criticality}</span>
                        : <span className="text-dim">—</span>}
                    </td>
                    <td className="text-dim" style={{ fontSize: 12 }}>
                      {row.fetched_at ? new Date(row.fetched_at).toLocaleString() : '—'}
                    </td>
                    {user?.role === 'admin' && (
                      <td>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => remove(row.ip_address)}
                          title="Remove from cache"
                        >✕</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {checkModal && (
        <CheckIPModal
          onClose={() => setCheckModal(false)}
          onChecked={() => { load(); }}
        />
      )}
    </div>
  );
}
