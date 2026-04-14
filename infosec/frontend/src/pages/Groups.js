import React, { useState, useEffect, useCallback, useContext } from 'react';
import { api, AuthContext } from '../App';
import { format } from 'date-fns';

const COLORS = ['#1f6feb','#f85149','#f0883e','#e3b341','#3fb950','#79c0ff','#bc8cff','#ff7b72'];

// ── Create / Edit group modal ────────────────────────────────────
function GroupFormModal({ group, onClose, onSaved }) {
  const [form, setForm] = useState({ name: group?.name || '', description: group?.description || '', color: group?.color || '#1f6feb' });
  const [err, setErr] = useState('');
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault(); setErr('');
    try {
      if (group?.id) await api.put(`/groups/${group.id}`, form);
      else await api.post('/groups', form);
      onSaved();
    } catch (ex) { setErr(ex.response?.data?.error || 'Error'); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{group?.id ? 'Edit Group' : 'New Group'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {err && <div className="alert alert-error">{err}</div>}
            <div className="form-group">
              <label>Group Name *</label>
              <input value={form.name} onChange={set('name')} required placeholder="e.g. SOC Team" />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={form.description} onChange={set('description')} rows={2} placeholder="What is this group for?" />
            </div>
            <div className="form-group">
              <label>Color</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(p => ({ ...p, color: c }))}
                    style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: form.color === c ? '3px solid #fff' : '2px solid transparent', cursor: 'pointer', flexShrink: 0 }} />
                ))}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{group?.id ? 'Save Changes' : 'Create Group'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Group detail modal (manage members) ─────────────────────────
function GroupDetailModal({ groupId, onClose, onChanged, currentUserRole, defaultTab = 'users' }) {
  const [group, setGroup]     = useState(null);
  const [tab, setTab]         = useState(defaultTab);
  const [allUsers, setAllUsers]   = useState([]);
  const [allAssets, setAllAssets] = useState([]);
  const [selUser, setSelUser]   = useState('');
  const [selAsset, setSelAsset] = useState('');
  const [loading, setLoading]   = useState(true);
  const isAdmin = currentUserRole === 'admin';

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get(`/groups/${groupId}`),
      api.get('/users'),
      api.get('/assets', { params: { limit: 200, status: 'active' } }),
    ]).then(([g, u, a]) => {
      setGroup(g.data);
      setAllUsers(u.data);
      setAllAssets(a.data.data);
    }).finally(() => setLoading(false));
  }, [groupId]);

  useEffect(() => { load(); }, [load]);

  const addUser = async () => {
    if (!selUser) return;
    await api.post(`/groups/${groupId}/users`, { user_id: selUser });
    setSelUser(''); load(); onChanged();
  };
  const removeUser = async userId => {
    await api.delete(`/groups/${groupId}/users/${userId}`);
    load(); onChanged();
  };
  const addAsset = async () => {
    if (!selAsset) return;
    await api.post(`/groups/${groupId}/assets`, { asset_id: selAsset });
    setSelAsset(''); load(); onChanged();
  };
  const removeAsset = async assetId => {
    await api.delete(`/groups/${groupId}/assets/${assetId}`);
    load(); onChanged();
  };

  const memberUserIds  = new Set((group?.users  || []).map(u => u.id));
  const memberAssetIds = new Set((group?.assets || []).map(a => a.id));
  const availableUsers  = allUsers.filter(u => !memberUserIds.has(u.id));
  const availableAssets = allAssets.filter(a => !memberAssetIds.has(a.id));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 680 }}>
        {loading || !group ? <div className="empty-state"><div className="spinner" /></div> : (<>
          <div className="modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: group.color, flexShrink: 0 }} />
              <h2>{group.name}</h2>
            </div>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>

          {group.description && (
            <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', color: 'var(--text2)', fontSize: 13 }}>
              {group.description}
            </div>
          )}

          <div style={{ padding: '0 20px' }}>
            <div className="tabs" style={{ marginTop: 16 }}>
              <button className={`tab-btn ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
                Users ({group.users.length})
              </button>
              <button className={`tab-btn ${tab === 'assets' ? 'active' : ''}`} onClick={() => setTab('assets')}>
                Assets ({group.assets.length})
              </button>
            </div>

            {/* Users tab */}
            {tab === 'users' && (
              <div style={{ paddingBottom: 20 }}>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <select className="filter-select" style={{ flex: 1 }} value={selUser} onChange={e => setSelUser(e.target.value)}>
                      <option value="">Select user to add...</option>
                      {availableUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.full_name || u.username} — {u.role}</option>
                      ))}
                    </select>
                    <button className="btn btn-primary" onClick={addUser} disabled={!selUser}>Add</button>
                  </div>
                )}
                {group.users.length === 0
                  ? <div className="empty-state" style={{ padding: 32 }}><p>No users in this group yet.</p></div>
                  : <table>
                      <thead><tr><th>User</th><th>Role</th><th>Department</th><th>Added</th>{isAdmin && <th></th>}</tr></thead>
                      <tbody>
                        {group.users.map(u => (
                          <tr key={u.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                                  {u.username[0].toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 500 }}>{u.full_name || u.username}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>@{u.username}</div>
                                </div>
                              </div>
                            </td>
                            <td><span className={`badge ${u.role === 'admin' ? 'badge-critical' : u.role === 'analyst' ? 'badge-medium' : 'badge-info'}`}>{u.role}</span></td>
                            <td className="text-muted">{u.department || '—'}</td>
                            <td className="text-dim">{format(new Date(u.added_at), 'MMM d, yyyy')}</td>
                            {isAdmin && <td><button className="btn btn-danger btn-sm" onClick={() => removeUser(u.id)}>Remove</button></td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                }
              </div>
            )}

            {/* Assets tab */}
            {tab === 'assets' && (
              <div style={{ paddingBottom: 20 }}>
                {(isAdmin || currentUserRole === 'analyst') && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <select className="filter-select" style={{ flex: 1 }} value={selAsset} onChange={e => setSelAsset(e.target.value)}>
                      <option value="">Select asset to add...</option>
                      {availableAssets.map(a => (
                        <option key={a.id} value={a.id}>{a.ip_address}{a.hostname ? ` — ${a.hostname}` : ''}</option>
                      ))}
                    </select>
                    <button className="btn btn-primary" onClick={addAsset} disabled={!selAsset}>Add</button>
                  </div>
                )}
                {group.assets.length === 0
                  ? <div className="empty-state" style={{ padding: 32 }}><p>No assets in this group yet.</p></div>
                  : <table>
                      <thead><tr><th>IP Address</th><th>Hostname</th><th>Type</th><th>Criticality</th><th>Added</th>{(isAdmin || currentUserRole === 'analyst') && <th></th>}</tr></thead>
                      <tbody>
                        {group.assets.map(a => (
                          <tr key={a.id}>
                            <td className="mono" style={{ color: 'var(--info)' }}>{a.ip_address}</td>
                            <td className="mono">{a.hostname || <span className="text-dim">—</span>}</td>
                            <td><span className="badge badge-info">{a.asset_type}</span></td>
                            <td><span style={{ color: { critical: 'var(--critical)', high: 'var(--high)', medium: 'var(--medium)', low: 'var(--low)' }[a.criticality], fontWeight: 600, fontSize: 12 }}>{a.criticality}</span></td>
                            <td className="text-dim">{format(new Date(a.added_at), 'MMM d, yyyy')}</td>
                            {(isAdmin || currentUserRole === 'analyst') && <td><button className="btn btn-danger btn-sm" onClick={() => removeAsset(a.id)}>Remove</button></td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                }
              </div>
            )}
          </div>
        </>)}
      </div>
    </div>
  );
}

// ── Main Groups page ─────────────────────────────────────────────
export default function Groups({ defaultTab = 'users' }) {
  const { user } = useContext(AuthContext);
  const [groups, setGroups]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [formModal, setFormModal] = useState(null);   // null | {} | group obj
  const [detailId, setDetailId]   = useState(null);
  const isAdmin = user?.role === 'admin';

  const load = useCallback(() => {
    setLoading(true);
    api.get('/groups').then(r => setGroups(r.data)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const deleteGroup = async id => {
    if (!window.confirm('Delete this group? Members will not be deleted.')) return;
    await api.delete(`/groups/${id}`);
    load();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{defaultTab === 'assets' ? 'Asset Groups' : 'User Groups'}</div>
          <div className="page-subtitle">{groups.length} group{groups.length !== 1 ? 's' : ''}</div>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setFormModal({})}>+ New Group</button>
        )}
      </div>

      {loading ? (
        <div className="empty-state"><div className="spinner" /></div>
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <p>No groups yet.{isAdmin ? ' Create one to organise users and assets.' : ''}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {groups.map(g => (
            <div key={g.id} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: g.color, flexShrink: 0, marginTop: 2 }} />
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{g.name}</div>
                </div>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setFormModal(g)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteGroup(g.id)}>Del</button>
                  </div>
                )}
              </div>

              {g.description && (
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 14, lineHeight: 1.5 }}>{g.description}</div>
              )}

              <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--info)' }}>{g.user_count}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Users</div>
                </div>
                <div style={{ width: 1, background: 'var(--border)' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--info)' }}>{g.asset_count}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assets</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  Created {format(new Date(g.created_at), 'MMM d, yyyy')}
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setDetailId(g.id)}>Manage</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formModal !== null && (
        <GroupFormModal
          group={formModal?.id ? formModal : null}
          onClose={() => setFormModal(null)}
          onSaved={() => { setFormModal(null); load(); }}
        />
      )}

      {detailId && (
        <GroupDetailModal
          groupId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={load}
          currentUserRole={user?.role}
          defaultTab={defaultTab}
        />
      )}
    </div>
  );
}
