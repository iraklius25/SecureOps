import React, { useState, useEffect, useCallback, useContext } from 'react';
import { api, AuthContext } from '../App';

const SEVERITIES = ['critical', 'high', 'medium', 'low'];
const STATUSES = ['pending', 'applied', 'not_applicable'];

function CoverageBar({ applied, total }) {
  const pct = total > 0 ? Math.round((applied / total) * 100) : 0;
  const color = pct === 100 ? 'var(--low)' : pct >= 50 ? 'var(--medium)' : 'var(--high)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 80, height: 6, background: 'var(--border2)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 12, color: 'var(--text3)' }}>{applied}/{total}</span>
    </div>
  );
}

function AddPatchModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    title: '', cve_id: '', severity: 'medium', vendor: '',
    product: '', patch_url: '', release_date: '', description: '',
  });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault(); setErr(''); setSaving(true);
    try {
      await api.post('/patches', form);
      onSaved();
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Error saving patch');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h2>Add Patch</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {err && <div className="alert alert-error" style={{ marginBottom: 12 }}>{err}</div>}
            <div className="form-group">
              <label>Title *</label>
              <input value={form.title} onChange={set('title')} required placeholder="e.g. OpenSSL Security Update" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>CVE ID</label>
                <input value={form.cve_id} onChange={set('cve_id')} placeholder="CVE-2024-1234" />
              </div>
              <div className="form-group">
                <label>Severity</label>
                <select value={form.severity} onChange={set('severity')}>
                  {SEVERITIES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Vendor</label>
                <input value={form.vendor} onChange={set('vendor')} placeholder="e.g. OpenSSL Foundation" />
              </div>
              <div className="form-group">
                <label>Product</label>
                <input value={form.product} onChange={set('product')} placeholder="e.g. OpenSSL" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Patch URL</label>
                <input type="url" value={form.patch_url} onChange={set('patch_url')} placeholder="https://..." />
              </div>
              <div className="form-group">
                <label>Release Date</label>
                <input type="date" value={form.release_date} onChange={set('release_date')} />
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={form.description} onChange={set('description')} rows={3} placeholder="Describe the vulnerability fixed and patch details..." />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Add Patch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PatchDetailModal({ patch, onClose, onUpdated }) {
  const { user } = useContext(AuthContext);
  const [patchAssets, setPatchAssets] = useState([]);
  const [allAssets, setAllAssets] = useState([]);
  const [addAssetId, setAddAssetId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const canEdit = ['admin', 'analyst'].includes(user?.role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pa, all] = await Promise.all([
        api.get(`/patches/${patch.id}/assets`),
        api.get('/assets', { params: { limit: 500 } }),
      ]);
      setPatchAssets(pa.data);
      setAllAssets(all.data.data || all.data);
      const linked = new Set(pa.data.map(a => a.asset_id));
      const first = (all.data.data || all.data).find(a => !linked.has(a.id));
      setAddAssetId(first?.id || '');
    } finally { setLoading(false); }
  }, [patch.id]);

  useEffect(() => { load(); }, [load]);

  const linkAsset = async () => {
    if (!addAssetId) return;
    setSaving(true);
    try {
      await api.post(`/patches/${patch.id}/assets`, { asset_id: addAssetId });
      onUpdated();
      load();
      const linked = new Set(patchAssets.map(a => a.asset_id).concat([parseInt(addAssetId)]));
      const next = allAssets.find(a => !linked.has(a.id));
      setAddAssetId(next?.id || '');
    } finally { setSaving(false); }
  };

  const updateStatus = async (assetId, status) => {
    await api.patch(`/patches/${patch.id}/assets/${assetId}`, { status });
    onUpdated();
    load();
  };

  const unlinkAsset = async assetId => {
    await api.delete(`/patches/${patch.id}/assets/${assetId}`);
    onUpdated();
    load();
  };

  const linkedIds = new Set(patchAssets.map(a => a.asset_id));
  const unlinkedAssets = allAssets.filter(a => !linkedIds.has(a.id));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 760 }}>
        <div className="modal-header">
          <div>
            <h2>{patch.title}</h2>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
              {patch.cve_id && (
                <a href={`https://nvd.nist.gov/vuln/detail/${patch.cve_id}`} target="_blank" rel="noopener noreferrer"
                   style={{ color: 'var(--info)', marginRight: 10 }}>{patch.cve_id} ↗</a>
              )}
              {patch.vendor && <span style={{ marginRight: 8 }}>{patch.vendor}</span>}
              {patch.product && <span style={{ marginRight: 8 }}>· {patch.product}</span>}
              {patch.release_date && <span>· Released {new Date(patch.release_date).toLocaleDateString()}</span>}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {patch.description && (
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 16, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 'var(--radius)' }}>
              {patch.description}
            </div>
          )}
          {patch.patch_url && (
            <div style={{ marginBottom: 16 }}>
              <a href={patch.patch_url} target="_blank" rel="noopener noreferrer"
                 className="btn btn-secondary btn-sm">
                🔗 Download / View Patch
              </a>
            </div>
          )}

          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
            Asset Coverage ({patchAssets.filter(a => a.status === 'applied').length}/{patchAssets.length} applied)
          </div>

          {loading ? (
            <div className="empty-state"><div className="spinner" /></div>
          ) : (
            <>
              {patchAssets.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>No assets linked to this patch yet.</div>
              ) : (
                <table style={{ marginBottom: 16 }}>
                  <thead>
                    <tr>
                      <th>Asset IP</th>
                      <th>Hostname</th>
                      <th>OS</th>
                      <th>Status</th>
                      <th>Applied At</th>
                      <th>Notes</th>
                      {canEdit && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {patchAssets.map(ap => (
                      <tr key={ap.id}>
                        <td className="mono" style={{ color: 'var(--info)' }}>{ap.ip_address}</td>
                        <td style={{ fontSize: 12 }}>{ap.hostname || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text3)' }}>{ap.os_name || '—'}</td>
                        <td>
                          {canEdit ? (
                            <select
                              value={ap.status}
                              onChange={e => updateStatus(ap.asset_id, e.target.value)}
                              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 'var(--radius)', padding: '3px 6px', fontSize: 12 }}
                            >
                              {STATUSES.map(s => <option key={s}>{s}</option>)}
                            </select>
                          ) : (
                            <span className={`badge badge-${ap.status === 'applied' ? 'low' : ap.status === 'not_applicable' ? 'info' : 'medium'}`}>{ap.status}</span>
                          )}
                        </td>
                        <td className="text-dim" style={{ fontSize: 12 }}>
                          {ap.applied_at ? new Date(ap.applied_at).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text3)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ap.notes || '—'}</td>
                        {canEdit && (
                          <td>
                            <button className="btn btn-danger btn-sm" onClick={() => unlinkAsset(ap.asset_id)} title="Unlink">✕</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {canEdit && unlinkedAssets.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>+ Link Asset</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                      <select value={addAssetId} onChange={e => setAddAssetId(e.target.value)}>
                        {unlinkedAssets.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.ip_address}{a.hostname ? ` — ${a.hostname}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button className="btn btn-primary" onClick={linkAsset} disabled={saving || !addAssetId}>
                      {saving ? 'Linking...' : 'Add Asset'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function Patches() {
  const { user } = useContext(AuthContext);
  const [patches, setPatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const canEdit = ['admin', 'analyst'].includes(user?.role);
  const isAdmin = user?.role === 'admin';

  const deletePatch = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Delete this patch record?')) return;
    await api.delete(`/patches/${id}`).catch(() => {});
    load();
  };

  const load = useCallback(() => {
    setLoading(true);
    api.get('/patches').then(r => setPatches(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Patch Tracker</div>
          <div className="page-subtitle">{patches.length} patches tracked</div>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => setAddModal(true)}>+ Add Patch</button>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          {loading ? (
            <div className="empty-state"><div className="spinner" /></div>
          ) : patches.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🩹</div>
              <p>No patches tracked yet. Add a patch to begin tracking remediation.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>CVE ID</th>
                  <th>Severity</th>
                  <th>Vendor</th>
                  <th>Product</th>
                  <th>Release Date</th>
                  <th>Coverage</th>
                  <th>Added By</th>
                  {isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {patches.map(p => (
                  <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(p)}>
                    <td style={{ fontWeight: 500 }}>{p.title}</td>
                    <td>
                      {p.cve_id ? (
                        <a
                          href={`https://nvd.nist.gov/vuln/detail/${p.cve_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="mono"
                          style={{ color: 'var(--info)', fontSize: 12 }}
                        >{p.cve_id} ↗</a>
                      ) : <span className="text-dim">—</span>}
                    </td>
                    <td><span className={`badge badge-${p.severity}`}>{p.severity}</span></td>
                    <td style={{ fontSize: 13, color: 'var(--text2)' }}>{p.vendor || <span className="text-dim">—</span>}</td>
                    <td style={{ fontSize: 13, color: 'var(--text2)' }}>{p.product || <span className="text-dim">—</span>}</td>
                    <td className="text-dim" style={{ fontSize: 12 }}>
                      {p.release_date ? new Date(p.release_date).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <CoverageBar applied={parseInt(p.applied_count) || 0} total={parseInt(p.total_assets) || 0} />
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text3)' }}>{p.created_by_username || '—'}</td>
                    {isAdmin && (
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={e => deletePatch(e, p.id)} title="Delete patch">🗑</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {addModal && (
        <AddPatchModal
          onClose={() => setAddModal(false)}
          onSaved={() => { setAddModal(false); load(); }}
        />
      )}

      {selected && (
        <PatchDetailModal
          patch={selected}
          onClose={() => setSelected(null)}
          onUpdated={load}
        />
      )}
    </div>
  );
}
