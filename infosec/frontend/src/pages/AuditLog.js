import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../App';
import { format } from 'date-fns';

const RESOURCES = ['','assets','vulnerabilities','risks','scans','users','groups','settings'];
const ACTION_ICONS = {
  create: '➕', update: '✏️', delete: '🗑️', login: '🔐', logout: '🔓',
  scan_started: '▶️', scan_completed: '✅', scan_failed: '❌',
};

export default function AuditLog() {
  const [data,     setData]     = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [resource, setResource] = useState('');
  const [action,   setAction]   = useState('');
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/audit', { params: { page, limit: 50, resource, action } })
      .then(r => { setData(r.data.data); setTotal(r.data.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, resource, action]);

  useEffect(() => { load(); }, [load]);

  const actionColor = a => {
    if (a?.includes('delete') || a?.includes('cancel')) return 'var(--critical)';
    if (a?.includes('create') || a?.includes('scan')) return 'var(--low)';
    if (a?.includes('update') || a?.includes('patch')) return 'var(--medium)';
    return 'var(--text2)';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Audit Log</div>
          <div className="page-subtitle">{total} events recorded</div>
        </div>
      </div>

      <div className="filter-bar">
        <select className="filter-select" value={resource} onChange={e => { setResource(e.target.value); setPage(1); }}>
          <option value="">All resources</option>
          {RESOURCES.filter(Boolean).map(r => <option key={r}>{r}</option>)}
        </select>
        <input className="search-input" placeholder="Filter by action..." value={action}
          onChange={e => { setAction(e.target.value); setPage(1); }} />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          {loading ? (
            <div className="empty-state"><div className="spinner" /></div>
          ) : data.length === 0 ? (
            <div className="empty-state"><p>No audit events found.</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>Details</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {data.map(e => (
                  <tr key={e.id}>
                    <td className="text-dim mono" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                      {format(new Date(e.created_at), 'MMM d HH:mm:ss')}
                    </td>
                    <td>
                      {e.username ? (
                        <div>
                          <div style={{ fontWeight: 500 }}>{e.full_name || e.username}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>@{e.username}</div>
                        </div>
                      ) : <span className="text-dim">system</span>}
                    </td>
                    <td>
                      <span style={{ color: actionColor(e.action), fontWeight: 500, fontSize: 12 }}>
                        {ACTION_ICONS[e.action] || '•'} {e.action}
                      </span>
                    </td>
                    <td>
                      {e.resource && <span className="badge badge-info">{e.resource}</span>}
                    </td>
                    <td style={{ maxWidth: 300, fontSize: 12, color: 'var(--text2)' }}>
                      {e.details && Object.keys(e.details).length > 0
                        ? Object.entries(e.details).slice(0, 3).map(([k, v]) =>
                            <span key={k} style={{ marginRight: 8 }}>
                              <span style={{ color: 'var(--text3)' }}>{k}:</span> {String(v).slice(0, 40)}
                            </span>
                          )
                        : <span className="text-dim">—</span>}
                    </td>
                    <td className="mono text-dim" style={{ fontSize: 11 }}>{e.ip_address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="pagination">
        <span className="page-info">{total} total</span>
        {Array.from({ length: Math.ceil(total / 50) }, (_, i) => i + 1).slice(0, 10).map(p => (
          <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
        ))}
      </div>
    </div>
  );
}
