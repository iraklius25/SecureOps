import React, { useState, useEffect, useCallback, useContext } from 'react';
import { api, AuthContext } from '../App';

// ── Helpers ────────────────────────────────────────────────────
function ScoreBar({ score }) {
  const color = score <= 25 ? '#22c55e' : score <= 50 ? '#eab308' : score <= 75 ? '#f97316' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 80, height: 8, background: 'var(--border2)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 28 }}>{score}</span>
    </div>
  );
}

function cvssColor(score) {
  if (!score) return 'var(--text3)';
  if (score >= 9) return '#ef4444';
  if (score >= 7) return '#f97316';
  if (score >= 4) return '#eab308';
  return '#22c55e';
}

function cvssLabel(score) {
  if (!score) return 'N/A';
  if (score >= 9) return 'Critical';
  if (score >= 7) return 'High';
  if (score >= 4) return 'Medium';
  return 'Low';
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text3)', minWidth: 130, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text1)', wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}

// ── Tab 1: AbuseIPDB ───────────────────────────────────────────
function AbuseIPDBTab({ user }) {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [ip, setIp]           = useState('');
  const [result, setResult]   = useState(null);
  const [checking, setChecking] = useState(false);
  const [msg, setMsg]         = useState('');
  const [err, setErr]         = useState('');
  const canEdit = ['admin', 'analyst'].includes(user?.role);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/threat').then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const checkIP = async e => {
    e.preventDefault(); setErr(''); setResult(null); setChecking(true);
    try {
      const r = await api.post('/threat/check', { ip });
      setResult(r.data); load();
    } catch (ex) { setErr(ex.response?.data?.error || 'Check failed'); }
    finally { setChecking(false); }
  };

  const scanAll = async () => {
    if (!window.confirm('Check all active assets against AbuseIPDB? This may take several minutes.')) return;
    setScanning(true); setMsg('');
    try {
      await api.post('/threat/scan-all');
      setMsg('Scan started in background. Results will appear as they are checked.');
      setTimeout(load, 5000);
    } catch (ex) { setMsg(ex.response?.data?.error || 'Scan failed'); }
    finally { setScanning(false); }
  };

  const remove = async ipAddr => {
    if (!window.confirm(`Remove ${ipAddr} from cache?`)) return;
    await api.delete(`/threat/${encodeURIComponent(ipAddr)}`);
    load();
  };

  return (
    <div>
      {canEdit && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Check Single IP</div>
          <form onSubmit={checkIP} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <input value={ip} onChange={e => setIp(e.target.value)} placeholder="e.g. 1.2.3.4"
              required pattern="^(\d{1,3}\.){3}\d{1,3}$" title="Valid IPv4"
              style={{ width: 200 }} />
            <button type="submit" className="btn btn-primary" disabled={checking || !ip}>
              {checking ? 'Checking…' : 'Check IP'}
            </button>
            {user?.role === 'admin' && (
              <button type="button" className="btn btn-secondary" onClick={scanAll} disabled={scanning}>
                {scanning ? 'Scanning…' : 'Scan All Assets'}
              </button>
            )}
          </form>
          {err && <div className="alert alert-error" style={{ marginTop: 10 }}>{err}</div>}
          {msg && <div className="alert alert-success" style={{ marginTop: 10 }}>{msg}</div>}
          {result && (
            <div style={{ marginTop: 14, padding: 14, background: 'var(--bg3)', borderRadius: 'var(--radius)', border: `1px solid ${result.is_malicious ? '#ef4444' : 'var(--border)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 15, fontFamily: 'monospace' }}>{result.ip_address}</span>
                <span className={`badge ${result.is_malicious ? 'badge-critical' : 'badge-low'}`}>
                  {result.is_malicious ? 'Malicious' : 'Clean'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 13 }}>
                <div><span style={{ color: 'var(--text3)' }}>Abuse Score: </span><strong>{result.abuse_score}/100</strong></div>
                <div><span style={{ color: 'var(--text3)' }}>Country: </span><strong>{result.country_code || '—'}</strong></div>
                <div><span style={{ color: 'var(--text3)' }}>ISP: </span><strong>{result.isp || '—'}</strong></div>
                <div><span style={{ color: 'var(--text3)' }}>Reports: </span><strong>{result.total_reports}</strong></div>
                {result.usage_type && <div style={{ gridColumn: '1/-1' }}><span style={{ color: 'var(--text3)' }}>Usage: </span><strong>{result.usage_type}</strong></div>}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          {loading ? <div className="empty-state"><div className="spinner" /></div>
          : data.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔥</div>
              <p>No data yet. Check an IP or scan all assets.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr><th>IP</th><th>Score</th><th>Status</th><th>Country</th><th>ISP</th><th>Reports</th><th>Hostname</th><th>Criticality</th><th>Checked</th>{user?.role === 'admin' && <th></th>}</tr>
              </thead>
              <tbody>
                {data.map(row => (
                  <tr key={row.ip_address}>
                    <td style={{ fontFamily: 'monospace', color: 'var(--info)', fontWeight: 600 }}>{row.ip_address}</td>
                    <td><ScoreBar score={row.abuse_score || 0} /></td>
                    <td><span className={`badge ${row.is_malicious ? 'badge-critical' : 'badge-low'}`}>{row.is_malicious ? 'Malicious' : 'Clean'}</span></td>
                    <td style={{ fontSize: 13 }}>{row.country_code || '—'}</td>
                    <td style={{ fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.isp || '—'}</td>
                    <td style={{ fontFamily: 'monospace' }}>{row.total_reports ?? 0}</td>
                    <td style={{ fontSize: 13 }}>{row.hostname || '—'}</td>
                    <td>{row.criticality ? <span className={`badge badge-${row.criticality}`}>{row.criticality}</span> : '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text3)' }}>{row.fetched_at ? new Date(row.fetched_at).toLocaleString() : '—'}</td>
                    {user?.role === 'admin' && <td><button className="btn btn-sm btn-danger" onClick={() => remove(row.ip_address)}>✕</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tab 2: Shodan ──────────────────────────────────────────────
function ShodanTab() {
  const [ip, setIp]       = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]     = useState('');

  const lookup = async e => {
    e.preventDefault(); setErr(''); setResult(null); setLoading(true);
    try {
      const r = await api.post('/threat/shodan', { ip });
      setResult(r.data);
    } catch (ex) { setErr(ex.response?.data?.error || 'Lookup failed'); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Shodan Host Lookup</div>
        <form onSubmit={lookup} style={{ display: 'flex', gap: 8 }}>
          <input value={ip} onChange={e => setIp(e.target.value)} placeholder="e.g. 8.8.8.8"
            required pattern="^(\d{1,3}\.){3}\d{1,3}$" title="Valid IPv4" style={{ width: 220 }} />
          <button type="submit" className="btn btn-primary" disabled={loading || !ip}>
            {loading ? 'Looking up…' : 'Lookup'}
          </button>
        </form>
        {err && <div className="alert alert-error" style={{ marginTop: 10 }}>{err}</div>}
      </div>

      {result && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Host Info */}
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Host Information</div>
            <InfoRow label="IP Address"   value={result.ip_str} />
            <InfoRow label="Hostnames"    value={result.hostnames?.join(', ')} />
            <InfoRow label="Organisation" value={result.org} />
            <InfoRow label="ISP"          value={result.isp} />
            <InfoRow label="ASN"          value={result.asn} />
            <InfoRow label="OS"           value={result.os} />
            <InfoRow label="Country"      value={result.country_name} />
            <InfoRow label="City"         value={result.city} />
            <InfoRow label="Last Scan"    value={result.last_update} />
            {result.tags?.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {result.tags.map(t => <span key={t} className="badge badge-info">{t}</span>)}
              </div>
            )}
          </div>

          {/* Open Ports */}
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 12 }}>
              Open Ports <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400 }}>({result.ports?.length || 0})</span>
            </div>
            {result.ports?.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {result.ports.map(p => (
                  <span key={p} style={{ fontFamily: 'monospace', fontSize: 13, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px' }}>{p}</span>
                ))}
              </div>
            ) : <p style={{ color: 'var(--text3)', fontSize: 13 }}>No open ports found.</p>}
          </div>

          {/* Services */}
          {result.data?.length > 0 && (
            <div className="card" style={{ gridColumn: '1/-1', padding: 0 }}>
              <div style={{ fontWeight: 600, padding: '14px 16px 10px' }}>Services ({result.data.length})</div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Port</th><th>Protocol</th><th>Product</th><th>Version</th><th>Transport</th><th>CPE</th></tr></thead>
                  <tbody>
                    {result.data.map((svc, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--info)' }}>{svc.port}</td>
                        <td>{svc._shodan?.module || '—'}</td>
                        <td>{svc.product || '—'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{svc.version || '—'}</td>
                        <td>{svc.transport || '—'}</td>
                        <td style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text3)' }}>{svc.cpe?.join(', ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Vulnerabilities from Shodan */}
          {result.vulns && Object.keys(result.vulns).length > 0 && (
            <div className="card" style={{ gridColumn: '1/-1', padding: 0 }}>
              <div style={{ fontWeight: 600, padding: '14px 16px 10px', color: '#ef4444' }}>
                Vulnerabilities ({Object.keys(result.vulns).length})
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>CVE</th><th>CVSS</th><th>Summary</th></tr></thead>
                  <tbody>
                    {Object.entries(result.vulns).map(([cve, info]) => (
                      <tr key={cve}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600, color: cvssColor(info.cvss), whiteSpace: 'nowrap' }}>{cve}</td>
                        <td>
                          <span style={{ fontWeight: 700, color: cvssColor(info.cvss) }}>{info.cvss ?? '—'}</span>
                          <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 5 }}>{cvssLabel(info.cvss)}</span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text2)' }}>{info.summary || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab 3: NVD CVE Search ──────────────────────────────────────
function NVDTab() {
  const [query, setQuery]   = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState('');

  const search = async e => {
    e.preventDefault(); setErr(''); setResult(null); setLoading(true);
    const isCVE = /^CVE-\d{4}-\d+$/i.test(query.trim());
    try {
      const r = await api.post('/threat/nvd', isCVE ? { cveId: query.trim() } : { query: query.trim() });
      setResult(r.data);
    } catch (ex) { setErr(ex.response?.data?.error || 'Search failed'); }
    finally { setLoading(false); }
  };

  const vulns = result?.vulnerabilities || [];

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>NVD CVE Search</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
          Enter a CVE ID (e.g. CVE-2021-44228) or keyword (e.g. "apache log4j")
        </div>
        <form onSubmit={search} style={{ display: 'flex', gap: 8 }}>
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="CVE-2021-44228 or apache log4j" required style={{ flex: 1, maxWidth: 420 }} />
          <button type="submit" className="btn btn-primary" disabled={loading || !query}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>
        {err && <div className="alert alert-error" style={{ marginTop: 10 }}>{err}</div>}
        {result && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)' }}>
            {result.totalResults} result{result.totalResults !== 1 ? 's' : ''} found
            {result.totalResults > 20 ? ' — showing first 20' : ''}
          </div>
        )}
      </div>

      {vulns.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {vulns.map(item => {
            const cve   = item.cve;
            const desc  = cve.descriptions?.find(d => d.lang === 'en')?.value || '—';
            const v31   = cve.metrics?.cvssMetricV31?.[0]?.cvssData;
            const v30   = cve.metrics?.cvssMetricV30?.[0]?.cvssData;
            const v2    = cve.metrics?.cvssMetricV2?.[0]?.cvssData;
            const cvss  = v31 || v30 || v2;
            const score = cvss?.baseScore;
            const severity = v31?.baseSeverity || v30?.baseSeverity || cve.metrics?.cvssMetricV2?.[0]?.baseSeverity;
            const refs  = cve.references?.slice(0, 3) || [];

            return (
              <div key={cve.id} className="card" style={{ borderLeft: `4px solid ${cvssColor(score)}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: cvssColor(score) }}>{cve.id}</span>
                  {score != null && (
                    <span style={{ fontWeight: 700, fontSize: 13, color: cvssColor(score) }}>
                      CVSS {score}
                    </span>
                  )}
                  {severity && (
                    <span className={`badge badge-${severity === 'CRITICAL' ? 'critical' : severity === 'HIGH' ? 'high' : severity === 'MEDIUM' ? 'medium' : 'low'}`}>
                      {severity}
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>
                    Published: {cve.published ? new Date(cve.published).toLocaleDateString() : '—'}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: refs.length ? 10 : 0 }}>{desc}</p>
                {refs.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {refs.map(r => (
                      <div key={r.url} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ color: 'var(--accent-h)' }}>↗</span> {r.url}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
const TABS = [
  { key: 'abuseipdb', label: 'AbuseIPDB', icon: '🛡️' },
  { key: 'shodan',    label: 'Shodan',    icon: '🌐' },
  { key: 'nvd',       label: 'NVD CVE',   icon: '🔎' },
];

export default function ThreatIntel() {
  const { user } = useContext(AuthContext);
  const [tab, setTab] = useState('abuseipdb');

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Threat Intelligence</div>
          <div className="page-subtitle">AbuseIPDB · Shodan · NVD CVE lookups</div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '8px 18px',
              fontSize: 14, fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? 'var(--accent-h)' : 'var(--text2)',
              borderBottom: tab === t.key ? '2px solid var(--accent-h)' : '2px solid transparent',
              marginBottom: -1, transition: 'all 0.15s',
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'abuseipdb' && <AbuseIPDBTab user={user} />}
      {tab === 'shodan'    && <ShodanTab />}
      {tab === 'nvd'       && <NVDTab />}
    </div>
  );
}
