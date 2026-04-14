import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../App';
import { format } from 'date-fns';

function NewKeyModal({ onClose, onCreated }) {
  const [form,    setForm]    = useState({ name: '', scopes: ['read'], expires_in_days: '' });
  const [created, setCreated] = useState(null);
  const [err,     setErr]     = useState('');
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const toggleScope = scope => {
    setForm(p => ({
      ...p,
      scopes: p.scopes.includes(scope) ? p.scopes.filter(s => s !== scope) : [...p.scopes, scope],
    }));
  };

  const submit = async e => {
    e.preventDefault(); setErr('');
    try {
      const r = await api.post('/apikeys', {
        name: form.name,
        scopes: form.scopes,
        expires_in_days: form.expires_in_days ? parseInt(form.expires_in_days) : undefined,
      });
      setCreated(r.data);
      onCreated();
    } catch (ex) { setErr(ex.response?.data?.error || 'Error'); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !created && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2>Create API Key</h2>
          {!created && <button className="modal-close" onClick={onClose}>✕</button>}
        </div>
        {created ? (
          <div className="modal-body">
            <div className="alert alert-success" style={{ marginBottom: 16 }}>
              API key created. Copy it now — it will not be shown again.
            </div>
            <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '12px 16px', fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all', color: 'var(--low)', marginBottom: 16 }}>
              {created.key}
            </div>
            <button className="btn btn-secondary" style={{ width: '100%' }}
              onClick={() => { navigator.clipboard?.writeText(created.key); }}>
              Copy to Clipboard
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="modal-body">
              {err && <div className="alert alert-error">{err}</div>}
              <div className="form-group">
                <label>Key Name *</label>
                <input value={form.name} onChange={set('name')} required placeholder="e.g. CI/CD Pipeline, SIEM Integration" />
              </div>
              <div className="form-group">
                <label>Scopes</label>
                <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                  {['read', 'write'].map(scope => (
                    <label key={scope} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={form.scopes.includes(scope)} onChange={() => toggleScope(scope)} />
                      {scope}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Expires in (days, leave blank for no expiry)</label>
                <input type="number" value={form.expires_in_days} onChange={set('expires_in_days')}
                  placeholder="e.g. 90" min="1" />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create Key</button>
            </div>
          </form>
        )}
        {created && (
          <div className="modal-footer">
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ApiKeys() {
  const [keys,      setKeys]      = useState([]);
  const [modal,     setModal]     = useState(false);
  const [loading,   setLoading]   = useState(true);

  const load = useCallback(() => {
    api.get('/apikeys').then(r => { setKeys(r.data); setLoading(false); }).catch(console.error);
  }, []);

  useEffect(() => { load(); }, [load]);

  const revoke = async id => {
    if (!window.confirm('Revoke this API key? This cannot be undone.')) return;
    await api.delete(`/apikeys/${id}`);
    load();
  };

  const toggleActive = async (id, is_active) => {
    await api.patch(`/apikeys/${id}`, { is_active });
    load();
  };

  const isExpired = key => key.expires_at && new Date(key.expires_at) < new Date();

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">API Keys</div>
          <div className="page-subtitle">Manage API keys for integrations and automation</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ New Key</button>
      </div>

      <div className="alert alert-warning" style={{ marginBottom: 20 }}>
        API keys provide programmatic access to SecureOps. Use the <code>Authorization: Bearer &lt;key&gt;</code> header. Keys with <code>write</code> scope can create/modify data.
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          {loading ? <div className="empty-state"><div className="spinner" /></div> :
          keys.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔑</div>
              <p>No API keys yet. Create one to integrate with external tools.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr><th>Name</th><th>Key Prefix</th><th>Scopes</th><th>Last Used</th><th>Expires</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {keys.map(k => (
                  <tr key={k.id} style={{ opacity: !k.is_active || isExpired(k) ? 0.6 : 1 }}>
                    <td style={{ fontWeight: 500 }}>{k.name}</td>
                    <td className="mono" style={{ color: 'var(--text3)' }}>{k.key_prefix}...</td>
                    <td>
                      {(k.scopes || []).map(s => (
                        <span key={s} className="badge badge-info" style={{ marginRight: 4 }}>{s}</span>
                      ))}
                    </td>
                    <td className="text-dim">{k.last_used ? format(new Date(k.last_used), 'MMM d, yyyy') : 'Never'}</td>
                    <td className="text-dim">
                      {k.expires_at
                        ? <span style={{ color: isExpired(k) ? 'var(--critical)' : 'var(--text2)' }}>
                            {isExpired(k) ? 'EXPIRED · ' : ''}{format(new Date(k.expires_at), 'MMM d, yyyy')}
                          </span>
                        : '—'}
                    </td>
                    <td>
                      <span className={`badge ${k.is_active && !isExpired(k) ? 'badge-low' : 'badge-critical'}`}>
                        {k.is_active && !isExpired(k) ? 'active' : 'inactive'}
                      </span>
                    </td>
                    <td style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => toggleActive(k.id, !k.is_active)}>
                        {k.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => revoke(k.id)}>Revoke</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && <NewKeyModal onClose={() => setModal(false)} onCreated={load} />}
    </div>
  );
}
