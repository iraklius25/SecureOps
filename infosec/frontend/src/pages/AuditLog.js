import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../App';

const RESOURCES = ['','assets','vulnerabilities','risks','scans','users','groups','settings','compliance','grc','certifications'];

const ACTION_META = {
  create:         { icon:'➕', color:'#10b981', label:'Create' },
  update:         { icon:'✏️',  color:'#3b82f6', label:'Update' },
  delete:         { icon:'🗑️',  color:'#ef4444', label:'Delete' },
  login:          { icon:'🔐', color:'#8b5cf6', label:'Login' },
  logout:         { icon:'🔓', color:'#6b7280', label:'Logout' },
  scan_started:   { icon:'▶️',  color:'#f59e0b', label:'Scan Started' },
  scan_completed: { icon:'✅', color:'#10b981', label:'Scan Completed' },
  scan_failed:    { icon:'❌', color:'#ef4444', label:'Scan Failed' },
  approve:        { icon:'👍', color:'#10b981', label:'Approve' },
  reject:         { icon:'👎', color:'#ef4444', label:'Reject' },
  patch:          { icon:'🩹', color:'#3b82f6', label:'Patch' },
};

function getMeta(action) {
  if (!action) return { icon:'●', color:'var(--text3)', label: action || 'unknown' };
  for (const [k, v] of Object.entries(ACTION_META)) {
    if (action.toLowerCase().includes(k)) return { ...v, label: action };
  }
  return { icon:'●', color:'var(--text3)', label: action };
}

function fmtFull(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function timeAgo(d) {
  if (!d) return '';
  const secs = Math.floor((Date.now() - new Date(d)) / 1000);
  if (secs < 60)   return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs/60)}m ago`;
  if (secs < 86400)return `${Math.floor(secs/3600)}h ago`;
  return `${Math.floor(secs/86400)}d ago`;
}

export default function AuditLog() {
  const [data,     setData]     = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [resource, setResource] = useState('');
  const [action,   setAction]   = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [loading,  setLoading]  = useState(true);
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' | 'table'
  const [expanded, setExpanded] = useState({});
  const [autoRefresh, setAutoRefresh] = useState(false);
  const LIMIT = 50;

  const load = useCallback(() => {
    setLoading(true);
    api.get('/audit', {
      params: { page, limit: LIMIT, resource, action,
                date_from: dateFrom || undefined, date_to: dateTo || undefined }
    })
      .then(r => { setData(r.data.data); setTotal(r.data.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, resource, action, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [autoRefresh, load]);

  const totalPages = Math.ceil(total / LIMIT);

  // Group events by date for timeline
  const grouped = {};
  data.forEach(e => {
    const day = fmtDate(e.created_at);
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(e);
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Audit Log</div>
          <div className="page-subtitle">{total.toLocaleString()} events recorded</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button
            onClick={() => setAutoRefresh(a => !a)}
            style={{ background: autoRefresh?'#10b98122':'var(--surface3)', border:`1px solid ${autoRefresh?'#10b981':'var(--border2)'}`,
                     borderRadius:6, padding:'6px 12px', cursor:'pointer', fontSize:12, color: autoRefresh?'#10b981':'var(--text2)' }}>
            {autoRefresh ? '⏸ Live' : '▶ Live'}
          </button>
          <button onClick={load} style={{ background:'var(--surface3)', border:'1px solid var(--border2)',
                 borderRadius:6, padding:'6px 12px', cursor:'pointer', fontSize:12, color:'var(--text2)' }}>
            ↺ Refresh
          </button>
          <div style={{ display:'flex', border:'1px solid var(--border2)', borderRadius:6, overflow:'hidden' }}>
            {['timeline','table'].map(m => (
              <button key={m} onClick={() => setViewMode(m)}
                style={{ background: viewMode===m?'var(--accent)':'var(--surface3)', border:'none', cursor:'pointer',
                         padding:'6px 14px', fontSize:12, color: viewMode===m?'#fff':'var(--text2)', fontWeight: viewMode===m?600:400 }}>
                {m === 'timeline' ? '📅 Timeline' : '📋 Table'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap', alignItems:'center' }}>
        <select className="filter-select" value={resource} onChange={e => { setResource(e.target.value); setPage(1); }}>
          <option value="">All resources</option>
          {RESOURCES.filter(Boolean).map(r => <option key={r}>{r}</option>)}
        </select>
        <input className="search-input" placeholder="Filter by action..." value={action}
               onChange={e => { setAction(e.target.value); setPage(1); }} style={{ width:200 }} />
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
               style={{ background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:6,
                        padding:'7px 10px', color:'var(--text1)', fontSize:13 }} title="From date" />
        <span style={{ color:'var(--text3)', fontSize:12 }}>→</span>
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
               style={{ background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:6,
                        padding:'7px 10px', color:'var(--text1)', fontSize:13 }} title="To date" />
        {(resource || action || dateFrom || dateTo) && (
          <button onClick={() => { setResource(''); setAction(''); setDateFrom(''); setDateTo(''); setPage(1); }}
                  style={{ background:'#ef444422', border:'1px solid #ef4444', borderRadius:6, padding:'6px 12px',
                           cursor:'pointer', fontSize:12, color:'#ef4444' }}>
            Clear filters
          </button>
        )}
        <div style={{ marginLeft:'auto', fontSize:12, color:'var(--text3)' }}>
          Page {page}/{totalPages || 1} · {total.toLocaleString()} total
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><div className="spinner" /></div>
      ) : data.length === 0 ? (
        <div className="empty-state"><p>No audit events found.</p></div>
      ) : viewMode === 'timeline' ? (
        <TimelineView grouped={grouped} expanded={expanded} setExpanded={setExpanded} />
      ) : (
        <TableView data={data} expanded={expanded} setExpanded={setExpanded} />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination" style={{ marginTop:16 }}>
          <button className="page-btn" onClick={() => setPage(1)} disabled={page===1}>«</button>
          <button className="page-btn" onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1}>‹</button>
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
            const start = Math.max(1, Math.min(page-4, totalPages-9));
            return start + i;
          }).map(p => (
            <button key={p} className={`page-btn ${p===page?'active':''}`} onClick={() => setPage(p)}>{p}</button>
          ))}
          <button className="page-btn" onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}>›</button>
          <button className="page-btn" onClick={() => setPage(totalPages)} disabled={page===totalPages}>»</button>
        </div>
      )}
    </div>
  );
}

/* ── Timeline View ────────────────────────────────────────────── */
function TimelineView({ grouped, expanded, setExpanded }) {
  return (
    <div>
      {Object.entries(grouped).map(([day, events]) => (
        <div key={day} style={{ marginBottom:28 }}>
          {/* Day header */}
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text2)', whiteSpace:'nowrap' }}>📅 {day}</div>
            <div style={{ flex:1, height:1, background:'var(--border1)' }} />
            <div style={{ fontSize:11, color:'var(--text3)' }}>{events.length} event{events.length!==1?'s':''}</div>
          </div>

          {/* Events */}
          <div style={{ position:'relative', paddingLeft:44 }}>
            <div style={{ position:'absolute', left:18, top:0, bottom:0, width:2, background:'var(--border1)' }} />
            {events.map(e => {
              const meta = getMeta(e.action);
              const isExp = expanded[e.id];
              return (
                <div key={e.id} style={{ position:'relative', marginBottom:10 }}>
                  {/* Timeline dot */}
                  <div style={{ position:'absolute', left:-34, top:12, width:28, height:28, borderRadius:'50%',
                                background:'var(--surface2)', border:`2px solid ${meta.color}`,
                                display:'flex', alignItems:'center', justifyContent:'center', fontSize:13,
                                boxShadow:`0 0 0 3px var(--surface1)` }}>
                    {meta.icon}
                  </div>

                  <div style={{ background:'var(--surface2)', border:'1px solid var(--border1)', borderRadius:10,
                                cursor:'pointer', transition:'border-color 0.15s',
                                borderLeft:`3px solid ${meta.color}` }}
                       onClick={() => setExpanded(ex => ({ ...ex, [e.id]: !ex[e.id] }))}>
                    {/* Event header */}
                    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px' }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                          <span style={{ fontSize:13, fontWeight:600, color:meta.color }}>{e.action}</span>
                          {e.resource && (
                            <span style={{ padding:'1px 7px', borderRadius:8, fontSize:11, fontWeight:600,
                                           background:'var(--surface3)', color:'var(--text2)', border:'1px solid var(--border2)' }}>
                              {e.resource}
                            </span>
                          )}
                          {e.resource_id && (
                            <span style={{ fontSize:10, color:'var(--text3)', fontFamily:'monospace' }}>
                              #{String(e.resource_id).slice(0,8)}
                            </span>
                          )}
                        </div>
                        <div style={{ display:'flex', gap:12, marginTop:4, fontSize:11, color:'var(--text3)' }}>
                          <span>
                            {e.full_name || e.username
                              ? <>👤 <strong style={{ color:'var(--text2)' }}>{e.full_name || e.username}</strong>{e.username && ` (@${e.username})`}</>
                              : <em>system</em>}
                          </span>
                          <span>🕐 {fmtTime(e.created_at)}</span>
                          <span style={{ color:'var(--text4, var(--text3))' }}>{timeAgo(e.created_at)}</span>
                          {e.ip_address && <span>🌐 {e.ip_address}</span>}
                        </div>
                      </div>
                      <span style={{ fontSize:11, color:'var(--text3)', flexShrink:0 }}>{isExp ? '▲' : '▼'}</span>
                    </div>

                    {/* Expanded details */}
                    {isExp && (
                      <div style={{ borderTop:'1px solid var(--border1)', padding:'10px 14px', background:'var(--surface3)' }}>
                        <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase',
                                      letterSpacing:'0.05em', marginBottom:8 }}>Details</div>
                        {e.details && Object.keys(e.details).length > 0 ? (
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:8 }}>
                            {Object.entries(e.details).map(([k, v]) => (
                              <div key={k} style={{ background:'var(--surface2)', borderRadius:6, padding:'6px 10px' }}>
                                <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:2 }}>{k}</div>
                                <div style={{ fontSize:12, color:'var(--text1)', wordBreak:'break-all',
                                              fontFamily: typeof v === 'object' ? 'monospace' : 'inherit' }}>
                                  {typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize:12, color:'var(--text3)' }}>No additional details.</span>
                        )}
                        <div style={{ marginTop:10, fontSize:11, color:'var(--text3)' }}>
                          Full timestamp: {fmtFull(e.created_at)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Table View ───────────────────────────────────────────────── */
function TableView({ data, expanded, setExpanded }) {
  return (
    <div className="card" style={{ padding:0 }}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width:140 }}>Date & Time</th>
              <th>User</th>
              <th>Action</th>
              <th>Resource</th>
              <th>Details</th>
              <th style={{ width:110 }}>IP Address</th>
            </tr>
          </thead>
          <tbody>
            {data.map(e => {
              const meta = getMeta(e.action);
              const isExp = expanded[e.id];
              return (
                <React.Fragment key={e.id}>
                  <tr style={{ cursor:'pointer' }} onClick={() => setExpanded(ex => ({ ...ex, [e.id]: !ex[e.id] }))}>
                    <td style={{ fontSize:11, whiteSpace:'nowrap' }}>
                      <div style={{ fontWeight:500, color:'var(--text1)' }}>{fmtDate(e.created_at)}</div>
                      <div style={{ color:'var(--text3)', fontFamily:'monospace' }}>{fmtTime(e.created_at)}</div>
                      <div style={{ color:'var(--text3)', fontSize:10 }}>{timeAgo(e.created_at)}</div>
                    </td>
                    <td>
                      {e.username ? (
                        <div>
                          <div style={{ fontWeight:600, fontSize:13 }}>{e.full_name || e.username}</div>
                          <div style={{ fontSize:11, color:'var(--text3)' }}>@{e.username}</div>
                        </div>
                      ) : <span className="text-dim">system</span>}
                    </td>
                    <td>
                      <span style={{ color:meta.color, fontWeight:600, fontSize:12 }}>
                        {meta.icon} {e.action}
                      </span>
                    </td>
                    <td>
                      {e.resource && <span className="badge badge-info">{e.resource}</span>}
                      {e.resource_id && (
                        <div style={{ fontSize:10, color:'var(--text3)', fontFamily:'monospace', marginTop:2 }}>
                          #{String(e.resource_id).slice(0,8)}
                        </div>
                      )}
                    </td>
                    <td style={{ maxWidth:280, fontSize:12, color:'var(--text2)' }}>
                      {e.details && Object.keys(e.details).length > 0
                        ? Object.entries(e.details).slice(0,3).map(([k,v]) => (
                            <span key={k} style={{ marginRight:8 }}>
                              <span style={{ color:'var(--text3)' }}>{k}:</span> {String(v).slice(0,40)}
                            </span>
                          ))
                        : <span className="text-dim">—</span>}
                    </td>
                    <td className="mono text-dim" style={{ fontSize:11 }}>{e.ip_address || '—'}</td>
                  </tr>
                  {isExp && (
                    <tr>
                      <td colSpan={6} style={{ background:'var(--surface3)', padding:'12px 16px', fontSize:12 }}>
                        <div style={{ fontWeight:700, color:'var(--text3)', fontSize:11, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>
                          Full Details — {fmtFull(e.created_at)}
                        </div>
                        {e.details && Object.keys(e.details).length > 0 ? (
                          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                            {Object.entries(e.details).map(([k,v]) => (
                              <div key={k} style={{ background:'var(--surface2)', borderRadius:6, padding:'6px 10px', maxWidth:300 }}>
                                <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', marginBottom:2 }}>{k}</div>
                                <div style={{ color:'var(--text1)', wordBreak:'break-all' }}>{typeof v==='object' ? JSON.stringify(v) : String(v)}</div>
                              </div>
                            ))}
                          </div>
                        ) : <span style={{ color:'var(--text3)' }}>No additional details.</span>}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
