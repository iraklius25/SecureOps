import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../App';

/* ─── Constants ──────────────────────────────────────────────── */
const CATEGORIES = [
  { id: 'software',     label: 'Software',     color: '#3b82f6' },
  { id: 'hardware',     label: 'Hardware',     color: '#8b5cf6' },
  { id: 'service',      label: 'Service',      color: '#10b981' },
  { id: 'license',      label: 'License',      color: '#f59e0b' },
  { id: 'subscription', label: 'Subscription', color: '#ec4899' },
  { id: 'other',        label: 'Other',        color: '#6b7280' },
];

const STATUSES = [
  { id: 'active',    label: 'Active',    color: '#10b981' },
  { id: 'pending',   label: 'Pending',   color: '#f59e0b' },
  { id: 'expired',   label: 'Expired',   color: '#ef4444' },
  { id: 'cancelled', label: 'Cancelled', color: '#6b7280' },
];

const CURRENCIES = ['USD','EUR','GBP','GEL','CHF','JPY','CAD','AUD'];

const SORT_OPTS = [
  { id: 'created_at', label: 'Date Added' },
  { id: 'name',       label: 'Name' },
  { id: 'amount',     label: 'Amount' },
  { id: 'expiry',     label: 'License Expiry' },
  { id: 'status',     label: 'Status' },
];

const catInfo  = id => CATEGORIES.find(c => c.id === id) || CATEGORIES[5];
const statInfo = id => STATUSES.find(s => s.id === id)   || STATUSES[0];

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

function expiryBadge(item) {
  if (!item.license_expiry_date) return null;
  const d = daysUntil(item.license_expiry_date);
  if (d < 0)  return { label: `Expired ${Math.abs(d)}d ago`, color: '#ef4444', bg: '#fef2f2' };
  if (d === 0) return { label: 'Expires today', color: '#ef4444', bg: '#fef2f2' };
  if (d <= (item.warn_days_before || 30)) return { label: `${d}d left`, color: '#f59e0b', bg: '#fffbeb' };
  return { label: `${d}d left`, color: '#6b7280', bg: 'transparent' };
}

function fmtAmount(amount, currency) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }).format(amount);
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ─── File Viewer Modal ──────────────────────────────────────── */
function FileViewerModal({ file, onClose }) {
  const viewUrl = `/api/budget/files/${file.id}/view`;
  const isImage = /image\//i.test(file.mimetype);
  const isPDF   = file.mimetype === 'application/pdf' || file.original_name.toLowerCase().endsWith('.pdf');

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()} style={{ zIndex: 1100 }}>
      <div className="modal" style={{ maxWidth: '90vw', width: 900, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: 15 }}>{file.original_name}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', padding: 0, minHeight: 0 }}>
          {isImage ? (
            <div style={{ padding: 16, textAlign: 'center', overflowY: 'auto', maxHeight: 'calc(92vh - 70px)' }}>
              <img src={viewUrl} alt={file.original_name} style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: 8 }} />
            </div>
          ) : isPDF ? (
            <iframe
              src={viewUrl}
              title={file.original_name}
              style={{ width: '100%', height: 'calc(92vh - 70px)', border: 'none' }}
            />
          ) : (
            <div style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
              <div style={{ color: 'var(--text2)', marginBottom: 16 }}>Preview not available for this file type.</div>
              <a href={viewUrl} download={file.original_name} className="btn btn-primary">Download File</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Files Panel ────────────────────────────────────────────── */
function FilesPanel({ itemId }) {
  const [files, setFiles]   = useState([]);
  const [uploading, setUp]  = useState(false);
  const [viewFile, setView] = useState(null);
  const fileRef             = useRef(null);

  const load = useCallback(() => {
    api.get(`/budget/${itemId}/files`).then(r => setFiles(r.data)).catch(() => {});
  }, [itemId]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setUp(true);
    try {
      await api.post(`/budget/${itemId}/files`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      load();
    } catch (ex) {
      alert(ex.response?.data?.error || 'Upload failed');
    } finally {
      setUp(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async id => {
    if (!window.confirm('Delete this file?')) return;
    try { await api.delete(`/budget/files/${id}`); load(); }
    catch (ex) { alert(ex.response?.data?.error || 'Delete failed'); }
  };

  const iconFor = name => {
    const ext = name.split('.').pop().toLowerCase();
    if (['png','jpg','jpeg'].includes(ext)) return '🖼';
    if (ext === 'pdf') return '📄';
    if (['xlsx','xls','csv'].includes(ext)) return '📊';
    if (['docx','doc'].includes(ext)) return '📝';
    if (['pptx','ppt'].includes(ext)) return '📑';
    return '📎';
  };

  return (
    <div>
      {viewFile && <FileViewerModal file={viewFile} onClose={() => setView(null)} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>Attachments ({files.length})</span>
        <label style={{ cursor: 'pointer' }}>
          <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} />
          <span className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 12px', pointerEvents: uploading ? 'none' : 'auto', opacity: uploading ? 0.5 : 1 }}>
            {uploading ? 'Uploading…' : '+ Upload'}
          </span>
        </label>
      </div>
      {files.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0' }}>No files attached yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {files.map(f => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg3)', borderRadius: 6 }}>
              <span style={{ fontSize: 16 }}>{iconFor(f.original_name)}</span>
              <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.original_name}</span>
              <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>{f.file_size ? `${(f.file_size / 1024).toFixed(1)} KB` : ''}</span>
              <button className="btn btn-secondary" style={{ fontSize: 11, padding: '3px 10px', flexShrink: 0 }} onClick={() => setView(f)}>View</button>
              <button className="btn btn-danger"    style={{ fontSize: 11, padding: '3px 8px',  flexShrink: 0 }} onClick={() => handleDelete(f.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Budget Form Modal ──────────────────────────────────────── */
const EMPTY = {
  org_id: '', name: '', description: '', category: 'license', amount: '', currency: 'USD',
  status: 'active', license_expiry_date: '', warn_days_before: 30,
  is_important: false, notify_smtp: false, notify_webhook: false, notes: '',
};

function BudgetModal({ item, orgs, onClose, onSaved }) {
  const editing = !!item;
  const [form, setForm] = useState(() =>
    item ? {
      org_id:              item.org_id              || '',
      name:                item.name                || '',
      description:         item.description         || '',
      category:            item.category            || 'license',
      amount:              item.amount != null ? item.amount : '',
      currency:            item.currency            || 'USD',
      status:              item.status              || 'active',
      license_expiry_date: item.license_expiry_date ? item.license_expiry_date.slice(0, 10) : '',
      warn_days_before:    item.warn_days_before     ?? 30,
      is_important:        item.is_important         ?? false,
      notify_smtp:         item.notify_smtp          ?? false,
      notify_webhook:      item.notify_webhook       ?? false,
      notes:               item.notes               || '',
    } : { ...EMPTY }
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const set = k => e => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(p => ({ ...p, [k]: val }));
  };

  const submit = async e => {
    e.preventDefault(); setErr('');
    if (!form.name.trim()) return setErr('Name is required');
    setSaving(true);
    try {
      const payload = {
        ...form,
        org_id:              form.org_id              || null,
        amount:              form.amount !== '' ? parseFloat(form.amount) : null,
        warn_days_before:    parseInt(form.warn_days_before, 10) || 30,
        license_expiry_date: form.license_expiry_date || null,
      };
      if (editing) {
        const r = await api.put(`/budget/${item.id}`, payload);
        onSaved(r.data, 'edit');
      } else {
        const r = await api.post('/budget', payload);
        onSaved(r.data, 'create');
      }
      onClose();
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 680, maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>{editing ? 'Edit Budget Item' : 'New Budget Item'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            {err && <div className="alert alert-error" style={{ gridColumn: '1/-1', marginBottom: 8 }}>{err}</div>}

            {/* Name */}
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Name *</label>
              <input value={form.name} onChange={set('name')} placeholder="e.g. Microsoft 365 Business" required />
            </div>

            {/* Organization */}
            <div className="form-group">
              <label>Organization</label>
              <select value={form.org_id} onChange={set('org_id')}>
                <option value="">— Not linked —</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>

            {/* Category */}
            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={set('category')}>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>

            {/* Amount */}
            <div className="form-group">
              <label>Amount</label>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0.00" />
            </div>

            {/* Currency */}
            <div className="form-group">
              <label>Currency</label>
              <select value={form.currency} onChange={set('currency')}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Status */}
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={set('status')}>
                {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>

            {/* License Expiry */}
            <div className="form-group">
              <label>License Expiry Date</label>
              <input type="date" value={form.license_expiry_date} onChange={set('license_expiry_date')} />
            </div>

            {/* Warn Days */}
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Warn how many days before expiry?</label>
              <input type="number" min="1" max="365" value={form.warn_days_before} onChange={set('warn_days_before')} />
              <small style={{ color: 'var(--text3)', fontSize: 11 }}>Notification fires when expiry is within this many days.</small>
            </div>

            {/* Description */}
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Description</label>
              <textarea value={form.description} onChange={set('description')} rows={2} placeholder="Short description of the item" />
            </div>

            {/* Notes */}
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Notes</label>
              <textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Internal notes, renewal contacts, etc." />
            </div>

            {/* Flags */}
            <div style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 0 4px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Options &amp; Alerts</div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                <input type="checkbox" checked={form.is_important} onChange={set('is_important')} style={{ width: 16, height: 16, flexShrink: 0 }} />
                <span>⭐ Mark as Important — pinned to top of list</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                <input type="checkbox" checked={form.notify_smtp} onChange={set('notify_smtp')} style={{ width: 16, height: 16, flexShrink: 0 }} />
                <span>✉️ Send email (SMTP) alert when license is about to expire</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                <input type="checkbox" checked={form.notify_webhook} onChange={set('notify_webhook')} style={{ width: 16, height: 16, flexShrink: 0 }} />
                <span>🔗 Send Slack / Teams webhook alert when license is about to expire</span>
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Detail Panel (side drawer) ─────────────────────────────── */
function DetailPanel({ item, orgs, onClose, onEdit, onDelete }) {
  const cat  = catInfo(item.category);
  const stat = statInfo(item.status);
  const exp  = expiryBadge(item);

  return (
    <div style={{
      width: 380, flexShrink: 0, background: 'var(--bg2)', borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
            {item.is_important && <span style={{ fontSize: 16 }}>⭐</span>}
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text1)' }}>{item.name}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: cat.color + '22', color: cat.color, fontWeight: 600 }}>{cat.label}</span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: stat.color + '22', color: stat.color, fontWeight: 600 }}>{stat.label}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => onEdit(item)}>Edit</button>
          <button className="btn btn-danger"    style={{ fontSize: 12, padding: '4px 8px'  }} onClick={() => onDelete(item)}>Delete</button>
          <button className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 8px'  }} onClick={onClose}>✕</button>
        </div>
      </div>

      {/* Fields */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <Row label="Organization" value={item.org_name || '—'} />
        <Row label="Amount"       value={fmtAmount(item.amount, item.currency)} accent />
        <Row label="License Expiry" value={
          item.license_expiry_date ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {fmtDate(item.license_expiry_date)}
              {exp && <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 20, background: exp.bg, color: exp.color, fontWeight: 600, border: `1px solid ${exp.color}33` }}>{exp.label}</span>}
            </span>
          ) : '—'
        } />
        <Row label="Warn Before"  value={item.license_expiry_date ? `${item.warn_days_before} days` : '—'} />
        <Row label="Date Added"   value={fmtDate(item.created_at)} />

        {/* Alerts */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {item.notify_smtp    && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#1d4ed822', color: '#3b82f6', fontWeight: 600 }}>✉️ Email alert</span>}
          {item.notify_webhook && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#7c3aed22', color: '#8b5cf6', fontWeight: 600 }}>🔗 Webhook alert</span>}
        </div>
      </div>

      {/* Description / Notes */}
      {(item.description || item.notes) && (
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
          {item.description && (
            <>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Description</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'pre-wrap', marginBottom: item.notes ? 12 : 0 }}>{item.description}</div>
            </>
          )}
          {item.notes && (
            <>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Notes</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>{item.notes}</div>
            </>
          )}
        </div>
      )}

      {/* Files */}
      <div style={{ padding: '16px 20px', flex: 1 }}>
        <FilesPanel itemId={item.id} />
      </div>
    </div>
  );
}

function Row({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: accent ? 15 : 13, fontWeight: accent ? 700 : 400, color: accent ? 'var(--accent)' : 'var(--text1)', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────── */
export default function Budget() {
  const [items,    setItems]    = useState([]);
  const [orgs,     setOrgs]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [modal,    setModal]    = useState(null); // null | 'create' | item-object

  /* Filters */
  const [fOrg,    setFOrg]    = useState('');
  const [fCat,    setFCat]    = useState('');
  const [fStatus, setFStatus] = useState('');
  const [sort,    setSort]    = useState('created_at');
  const [dir,     setDir]     = useState('desc');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (fOrg)    params.org_id   = fOrg;
      if (fCat)    params.category = fCat;
      if (fStatus) params.status   = fStatus;
      params.sort = sort;
      params.dir  = dir;
      const [itemsRes, orgsRes] = await Promise.all([
        api.get('/budget', { params }),
        api.get('/budget/orgs'),
      ]);
      setItems(itemsRes.data);
      setOrgs(orgsRes.data);
    } catch {
      setItems([]);
    } finally { setLoading(false); }
  }, [fOrg, fCat, fStatus, sort, dir]);

  useEffect(() => { load(); }, [load]);

  const handleSaved = (saved, op) => {
    if (op === 'create') {
      setItems(p => [saved, ...p]);
    } else {
      setItems(p => p.map(x => x.id === saved.id ? { ...x, ...saved } : x));
      if (selected?.id === saved.id) setSelected(prev => ({ ...prev, ...saved }));
    }
  };

  const handleDelete = async item => {
    if (!window.confirm(`Delete "${item.name}"? This will also remove all attached files.`)) return;
    try {
      await api.delete(`/budget/${item.id}`);
      setItems(p => p.filter(x => x.id !== item.id));
      if (selected?.id === item.id) setSelected(null);
    } catch (ex) {
      alert(ex.response?.data?.error || 'Delete failed');
    }
  };

  const toggleSort = col => {
    if (sort === col) setDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSort(col); setDir('asc'); }
  };

  const sortIcon = col => sort === col ? (dir === 'asc' ? ' ▲' : ' ▼') : '';

  /* Summary stats */
  const totalActive   = items.filter(i => i.status === 'active').length;
  const totalBudget   = items.filter(i => i.status === 'active' && i.amount != null).reduce((s, i) => s + parseFloat(i.amount || 0), 0);
  const expiringSoon  = items.filter(i => { const d = daysUntil(i.license_expiry_date); return d != null && d >= 0 && d <= (i.warn_days_before || 30); }).length;
  const importantCnt  = items.filter(i => i.is_important).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>IT Budget &amp; Licenses</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text3)', fontSize: 13 }}>Track software, hardware, services, and license expiry across your organisation.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('create')}>+ New Item</button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Active Items', value: totalActive,               color: '#10b981' },
          { label: 'Total Budget', value: `$${Math.round(totalBudget).toLocaleString()}`, color: '#3b82f6' },
          { label: 'Expiring Soon', value: expiringSoon,              color: '#f59e0b' },
          { label: 'Important',    value: importantCnt,               color: '#ec4899' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '14px 18px', borderLeft: `3px solid ${s.color}` }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={fOrg} onChange={e => setFOrg(e.target.value)} style={{ fontSize: 13 }}>
          <option value="">All Organizations</option>
          <option value="none">No Organization</option>
          {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>

        <select value={fCat} onChange={e => setFCat(e.target.value)} style={{ fontSize: 13 }}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>

        <select value={fStatus} onChange={e => setFStatus(e.target.value)} style={{ fontSize: 13 }}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto' }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Sort by:</span>
          {SORT_OPTS.map(o => (
            <button
              key={o.id}
              className={`btn btn-secondary${sort === o.id ? ' active' : ''}`}
              style={{ fontSize: 12, padding: '4px 10px' }}
              onClick={() => toggleSort(o.id)}
            >
              {o.label}{sortIcon(o.id)}
            </button>
          ))}
        </div>
      </div>

      {/* Main content: table + detail panel */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: 0 }}>
        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading…</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text3)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>No budget items yet</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>Click "New Item" to add your first entry.</div>
            </div>
          ) : (
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: 24 }}></th>
                  <th>Name</th>
                  <th>Organization</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>License Expiry</th>
                  <th>Status</th>
                  <th>Alerts</th>
                  <th>Files</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const cat  = catInfo(item.category);
                  const stat = statInfo(item.status);
                  const exp  = expiryBadge(item);
                  const isSelected = selected?.id === item.id;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelected(isSelected ? null : item)}
                      style={{
                        cursor: 'pointer',
                        background: isSelected ? 'var(--accent-bg, var(--bg3))' : undefined,
                        outline: isSelected ? '1px solid var(--accent)' : undefined,
                      }}
                    >
                      <td style={{ textAlign: 'center', fontSize: 14 }}>{item.is_important ? '⭐' : ''}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--text1)' }}>{item.name}</span>
                        {item.description && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{item.description.slice(0, 60)}{item.description.length > 60 ? '…' : ''}</div>}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text2)' }}>{item.org_name || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                      <td>
                        <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 20, background: cat.color + '22', color: cat.color, fontWeight: 600 }}>{cat.label}</span>
                      </td>
                      <td style={{ fontWeight: 600, fontSize: 13 }}>{fmtAmount(item.amount, item.currency)}</td>
                      <td>
                        {item.license_expiry_date ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 13 }}>{fmtDate(item.license_expiry_date)}</span>
                            {exp && <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 20, background: exp.bg, color: exp.color, fontWeight: 600, alignSelf: 'flex-start', border: `1px solid ${exp.color}33` }}>{exp.label}</span>}
                          </div>
                        ) : <span style={{ color: 'var(--text3)' }}>—</span>}
                      </td>
                      <td>
                        <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 20, background: stat.color + '22', color: stat.color, fontWeight: 600 }}>{stat.label}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {item.notify_smtp    && <span title="Email alert"   style={{ fontSize: 14 }}>✉️</span>}
                          {item.notify_webhook && <span title="Webhook alert" style={{ fontSize: 14 }}>🔗</span>}
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text3)' }}>
                        {parseInt(item.file_count, 10) > 0
                          ? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{item.file_count} file{item.file_count > 1 ? 's' : ''}</span>
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <DetailPanel
            item={selected}
            orgs={orgs}
            onClose={() => setSelected(null)}
            onEdit={item => { setModal(item); }}
            onDelete={handleDelete}
          />
        )}
      </div>

      {/* Modals */}
      {modal && (
        <BudgetModal
          item={modal === 'create' ? null : modal}
          orgs={orgs}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
