import React, { useState, useEffect, useCallback, useContext } from 'react';
import { api, AuthContext } from '../App';
import { format } from 'date-fns';

/* ── Constants ─────────────────────────────────────────────────── */
const TYPES  = ['unknown','server','workstation','network_device','iot','cloud','mobile'];
const CRIT   = ['critical','high','medium','low'];
const STATUS = ['active','inactive','decommissioned','unknown'];

const CLASSIFICATIONS = [
  { id: 'public',       label: 'Public',       color: '#10b981', bg: '#10b98120', desc: 'No harm if disclosed publicly' },
  { id: 'internal',     label: 'Internal',     color: '#3b82f6', bg: '#3b82f620', desc: 'Internal use only — not for public release' },
  { id: 'confidential', label: 'Confidential', color: '#f59e0b', bg: '#f59e0b20', desc: 'Sensitive — limited distribution, need-to-know' },
  { id: 'restricted',   label: 'Restricted',   color: '#ef4444', bg: '#ef444420', desc: 'Highly sensitive — strict need-to-know, senior approval required' },
];

const ASSET_CATEGORIES = [
  { id: 'hardware',      label: 'Hardware',         icon: '🖥' },
  { id: 'software',      label: 'Software',         icon: '💿' },
  { id: 'information',   label: 'Information',      icon: '📄' },
  { id: 'service',       label: 'Service',          icon: '⚙️' },
  { id: 'people',        label: 'People',           icon: '👤' },
  { id: 'facility',      label: 'Facility',         icon: '🏢' },
  { id: 'cloud',         label: 'Cloud Service',    icon: '☁️' },
  { id: 'mobile_device', label: 'Mobile Device',    icon: '📱' },
  { id: 'virtual',       label: 'Virtual/Container',icon: '📦' },
  { id: 'other',         label: 'Other',            icon: '•' },
];

const DATA_TYPES_OPTIONS = [
  'Personal Data (PII)', 'Financial Data', 'Health Data', 'Customer Data',
  'Intellectual Property', 'Authentication Credentials', 'Operational Data', 'Public Data',
];

const CHANGE_ICONS = {
  port_added:      { icon: '➕', color: 'var(--low)' },
  port_removed:    { icon: '➖', color: 'var(--critical)' },
  service_changed: { icon: '🔄', color: 'var(--medium)' },
  os_changed:      { icon: '💻', color: 'var(--info)' },
  first_seen:      { icon: '🆕', color: 'var(--low)' },
};

/* ── Helpers ───────────────────────────────────────────────────── */
const clf  = id => CLASSIFICATIONS.find(c => c.id === id) || CLASSIFICATIONS[1];
const cat  = id => ASSET_CATEGORIES.find(c => c.id === id) || ASSET_CATEGORIES[0];
const critColor = { critical:'var(--critical)', high:'var(--high)', medium:'var(--medium)', low:'var(--low)' };
const fmtD = d => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const isOverdue = d => d && new Date(d) < new Date();

const ClassBadge = ({ classification }) => {
  const c = clf(classification || 'internal');
  return (
    <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:10,
                   fontSize:11, fontWeight:700, background:c.bg, color:c.color, whiteSpace:'nowrap',
                   border:`1px solid ${c.color}40` }}>
      {c.label}
    </span>
  );
};

/* ── Change History Modal ──────────────────────────────────────── */
function AssetHistoryModal({ asset, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/assets/${asset.id}/history`)
      .then(r => setHistory(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [asset.id]);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 700 }}>
        <div className="modal-header">
          <div>
            <h2>Change History</h2>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{asset.ip_address}{asset.hostname ? ` — ${asset.hostname}` : ''}</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="empty-state"><div className="spinner" /></div>
          ) : history.length === 0 ? (
            <div className="empty-state"><p>No change history recorded yet.</p></div>
          ) : (
            <table>
              <thead>
                <tr><th>Time</th><th>Change</th><th>Field</th><th>Before</th><th>After</th><th>Scan</th></tr>
              </thead>
              <tbody>
                {history.map(h => {
                  const meta = CHANGE_ICONS[h.change_type] || { icon: '•', color: 'var(--text2)' };
                  return (
                    <tr key={h.id}>
                      <td className="mono text-dim" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                        {format(new Date(h.created_at), 'MMM d HH:mm')}
                      </td>
                      <td><span style={{ color: meta.color, fontWeight: 500, fontSize: 12 }}>{meta.icon} {h.change_type.replace(/_/g, ' ')}</span></td>
                      <td className="text-dim" style={{ fontSize: 12 }}>{h.field || '—'}</td>
                      <td className="mono" style={{ fontSize: 11, color: 'var(--critical)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.old_value || '—'}</td>
                      <td className="mono" style={{ fontSize: 11, color: 'var(--low)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.new_value || '—'}</td>
                      <td className="text-dim" style={{ fontSize: 11 }}>{h.scan_name || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ── Tag Input ─────────────────────────────────────────────────── */
function TagInput({ value = [], onChange }) {
  const [input, setInput] = useState('');
  const tags = Array.isArray(value) ? value : [];
  const add = () => { const t = input.trim(); if (t && !tags.includes(t)) onChange([...tags, t]); setInput(''); };
  const remove = tag => onChange(tags.filter(t => t !== tag));
  return (
    <div style={{ border: '1px solid var(--border2)', borderRadius: 'var(--radius)', padding: '6px 8px', background: 'var(--bg3)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: tags.length ? 6 : 0 }}>
        {tags.map(t => (
          <span key={t} style={{ display:'flex', alignItems:'center', gap:4, background:'var(--accent)', color:'#fff',
                                  borderRadius:4, padding:'2px 8px', fontSize:11, fontWeight:500 }}>
            {t}
            <button type="button" onClick={() => remove(t)}
              style={{ background:'none', border:'none', cursor:'pointer', color:'inherit', padding:0, lineHeight:1, fontSize:12 }}>✕</button>
          </span>
        ))}
      </div>
      <div style={{ display:'flex', gap:6 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key==='Enter') { e.preventDefault(); add(); } }}
          placeholder="Add tag, press Enter"
          style={{ flex:1, background:'none', border:'none', outline:'none', fontSize:12, color:'var(--text)' }} />
        <button type="button" onClick={add} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--accent)', fontSize:12 }}>+ Add</button>
      </div>
    </div>
  );
}

/* ── Data Types Checkbox Group ─────────────────────────────────── */
function DataTypesInput({ value = [], onChange }) {
  const vals = Array.isArray(value) ? value : [];
  const toggle = v => onChange(vals.includes(v) ? vals.filter(x => x !== v) : [...vals, v]);
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
      {DATA_TYPES_OPTIONS.map(dt => (
        <label key={dt} style={{ display:'flex', alignItems:'center', gap:7, fontSize:12, cursor:'pointer',
                                  padding:'5px 8px', borderRadius:6, background:'var(--surface3)',
                                  border:`1px solid ${vals.includes(dt) ? 'var(--accent)' : 'var(--border2)'}`,
                                  color: vals.includes(dt) ? 'var(--accent)' : 'var(--text2)' }}>
          <input type="checkbox" checked={vals.includes(dt)} onChange={() => toggle(dt)}
            style={{ accentColor:'var(--accent)', cursor:'pointer', width:13, height:13 }} />
          {dt}
        </label>
      ))}
    </div>
  );
}

/* ── Asset Detail Modal (ISO 27001 Record View) ────────────────── */
function AssetDetailModal({ asset, onClose, onEdit, canEdit }) {
  const c = clf(asset.classification || 'internal');
  const cc = critColor[asset.criticality] || 'var(--text2)';
  const reviewOverdue = isOverdue(asset.review_date);

  const Section = ({ title, children }) => (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase',
                    letterSpacing:'0.07em', marginBottom:10, paddingBottom:6,
                    borderBottom:'1px solid var(--border1)' }}>
        {title}
      </div>
      {children}
    </div>
  );

  const Field = ({ label, value, mono, color }) => (
    <div style={{ marginBottom:8 }}>
      <div style={{ fontSize:11, color:'var(--text3)', marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:13, color: color || 'var(--text1)', fontFamily: mono ? 'monospace' : undefined,
                    fontWeight: color ? 600 : 400 }}>
        {value || <span style={{ color:'var(--text3)', fontStyle:'italic' }}>Not set</span>}
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:740, width:'96%' }}>
        <div className="modal-header" style={{ borderLeft:`4px solid ${c.color}` }}>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
              <ClassBadge classification={asset.classification} />
              <span style={{ fontSize:11, color:cc, fontWeight:700, background:`${cc}18`,
                              padding:'2px 8px', borderRadius:10, border:`1px solid ${cc}40` }}>
                {asset.criticality?.toUpperCase()}
              </span>
              <span style={{ fontSize:11, color:'var(--text3)' }}>{asset.status}</span>
            </div>
            <h2 style={{ margin:0 }}>{asset.hostname || asset.ip_address}</h2>
            <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>
              {asset.hostname && <span style={{ fontFamily:'monospace', marginRight:8 }}>{asset.ip_address}</span>}
              {cat(asset.asset_category).icon} {cat(asset.asset_category).label}
              {asset.department && <span style={{ marginLeft:8 }}>· {asset.department}</span>}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ maxHeight:'72vh', overflowY:'auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
            {/* Left column */}
            <div>
              <Section title="Identity">
                <Field label="IP Address"   value={asset.ip_address}  mono />
                <Field label="Hostname"      value={asset.hostname} />
                <Field label="Operating System" value={asset.os_name} />
                <Field label="Asset Type"    value={asset.asset_type} />
                <Field label="Asset Category (ISO 27001)" value={`${cat(asset.asset_category).icon} ${cat(asset.asset_category).label}`} />
              </Section>

              <Section title="ISO 27001 — Classification (Annex A 5.12)">
                <div style={{ padding:'10px 14px', background:c.bg, border:`1px solid ${c.color}40`,
                               borderRadius:8, marginBottom:10 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:c.color, marginBottom:4 }}>{c.label}</div>
                  <div style={{ fontSize:12, color:'var(--text2)' }}>{c.desc}</div>
                </div>
                {asset.data_types?.length > 0 && (
                  <div>
                    <div style={{ fontSize:11, color:'var(--text3)', marginBottom:6 }}>Data Types Processed / Stored</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      {asset.data_types.map(dt => (
                        <span key={dt} style={{ fontSize:11, padding:'2px 8px', borderRadius:8,
                                                 background:'var(--surface3)', color:'var(--text2)',
                                                 border:'1px solid var(--border2)' }}>{dt}</span>
                      ))}
                    </div>
                  </div>
                )}
              </Section>

              <Section title="Review Status (Annex A 5.9)">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div style={{ padding:'10px 12px', borderRadius:8,
                                 background: reviewOverdue ? '#ef444418' : 'var(--surface3)',
                                 border:`1px solid ${reviewOverdue ? '#ef4444' : 'var(--border2)'}` }}>
                    <div style={{ fontSize:10, color: reviewOverdue ? '#ef4444' : 'var(--text3)',
                                   fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>
                      {reviewOverdue ? '⚠ OVERDUE' : 'Next Review'}
                    </div>
                    <div style={{ fontSize:13, fontWeight:600,
                                   color: reviewOverdue ? '#ef4444' : 'var(--text1)' }}>
                      {fmtD(asset.review_date)}
                    </div>
                  </div>
                  <div style={{ padding:'10px 12px', borderRadius:8, background:'var(--surface3)', border:'1px solid var(--border2)' }}>
                    <div style={{ fontSize:10, color:'var(--text3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>Last Reviewed</div>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--text1)' }}>{fmtD(asset.last_reviewed_at)}</div>
                    {asset.reviewed_by && <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>by {asset.reviewed_by}</div>}
                  </div>
                </div>
              </Section>
            </div>

            {/* Right column */}
            <div>
              <Section title="Ownership (Annex A 5.9)">
                <Field label="Asset Owner (Accountable)"     value={asset.owner} />
                <Field label="Asset Custodian (Day-to-day)"  value={asset.custodian} />
                <Field label="Department"                     value={asset.department} />
                <Field label="Location"                       value={asset.location} />
              </Section>

              <Section title="Risk & Financial">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:10 }}>
                  {[
                    { label:'Asset Value', value:`$${Number(asset.asset_value||0).toLocaleString()}`, color:'var(--text1)' },
                    { label:'Open Vulns',  value:asset.open_vulns||0,  color: asset.open_vulns > 0 ? 'var(--high)' : 'var(--text3)' },
                    { label:'Critical',    value:asset.critical_vulns||0, color: asset.critical_vulns > 0 ? 'var(--critical)' : 'var(--text3)' },
                  ].map(s => (
                    <div key={s.label} style={{ padding:'8px 10px', background:'var(--surface3)', borderRadius:8, border:'1px solid var(--border2)', textAlign:'center' }}>
                      <div style={{ fontSize:16, fontWeight:700, color:s.color }}>{s.value}</div>
                      <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                {asset.total_ale > 0 && (
                  <div style={{ padding:'8px 12px', background:'#ef444410', border:'1px solid #ef444430', borderRadius:8, fontSize:12, color:'#ef4444' }}>
                    Annual Loss Expectancy (ALE): <strong>${Number(asset.total_ale).toLocaleString(undefined, { maximumFractionDigits:0 })}</strong>
                  </div>
                )}
              </Section>

              <Section title="Network">
                <Field label="Open Ports"   value={asset.open_ports ? `${asset.open_ports} open` : '0'} />
                <Field label="Last Seen"    value={asset.last_seen ? format(new Date(asset.last_seen), 'dd MMM yyyy HH:mm') : null} />
                <Field label="First Seen"   value={asset.first_seen ? format(new Date(asset.first_seen), 'dd MMM yyyy HH:mm') : null} />
              </Section>

              {asset.tags?.length > 0 && (
                <Section title="Tags">
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    {asset.tags.map(t => (
                      <span key={t} style={{ fontSize:11, padding:'2px 8px', background:'var(--accent)20',
                                             color:'var(--accent)', borderRadius:4, border:'1px solid var(--accent)40' }}>{t}</span>
                    ))}
                  </div>
                </Section>
              )}

              {asset.notes && (
                <Section title="Notes">
                  <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.6 }}>{asset.notes}</div>
                </Section>
              )}

              {asset.status === 'decommissioned' && asset.disposal_notes && (
                <Section title="Disposal Notes (Annex A 7.14)">
                  <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.6 }}>{asset.disposal_notes}</div>
                </Section>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" style={{ marginRight:'auto' }}
            onClick={onClose}>Close</button>
          {canEdit && <button className="btn btn-primary" onClick={() => { onClose(); onEdit(); }}>Edit Asset</button>}
        </div>
      </div>
    </div>
  );
}

/* ── Asset Add / Edit Modal ────────────────────────────────────── */
function AssetModal({ asset, onClose, onSaved }) {
  const [form, setForm] = useState(asset?.id ? {
    ...asset,
    review_date:     asset.review_date?.slice(0,10) || '',
    last_reviewed_at:asset.last_reviewed_at?.slice(0,10) || '',
    data_types:      asset.data_types || [],
    tags:            asset.tags || [],
  } : {
    ip_address:'', hostname:'', asset_type:'unknown', asset_category:'hardware',
    criticality:'medium', classification:'internal', department:'', owner:'',
    custodian:'', location:'', asset_value:50000, notes:'', status:'active',
    tags:[], data_types:[], review_date:'', last_reviewed_at:'', reviewed_by:'', disposal_notes:'',
  });
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('basic');

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault(); setErr('');
    try {
      if (asset?.id) await api.put(`/assets/${asset.id}`, form);
      else await api.post('/assets', form);
      onSaved();
    } catch(ex) { setErr(ex.response?.data?.error || 'Error'); }
  };

  const TABS = [
    { id:'basic',  label:'Basic Info' },
    { id:'iso',    label:'ISO 27001 Classification' },
    { id:'review', label:'Ownership & Review' },
  ];

  const inp = { width:'100%', background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:6, padding:'8px 10px', color:'var(--text1)', fontSize:13, boxSizing:'border-box' };
  const sel = { ...inp };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:640 }}>
        <div className="modal-header">
          <h2>{asset?.id ? 'Edit Asset' : 'Add Asset'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          {/* Tab bar */}
          <div style={{ display:'flex', gap:2, padding:'0 20px', borderBottom:'1px solid var(--border1)', background:'var(--surface2)' }}>
            {TABS.map(t => (
              <button key={t.id} type="button"
                style={{ padding:'10px 14px', background:'none', border:'none', cursor:'pointer',
                          fontSize:12, fontWeight:600, color: tab===t.id ? 'var(--accent)' : 'var(--text3)',
                          borderBottom: tab===t.id ? '2px solid var(--accent)' : '2px solid transparent',
                          marginBottom:-1 }}
                onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="modal-body" style={{ maxHeight:'60vh', overflowY:'auto' }}>
            {err && <div className="alert alert-error" style={{ marginBottom:12 }}>{err}</div>}

            {/* Basic Info */}
            {tab === 'basic' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div className="form-group">
                    <label>IP Address *</label>
                    <input style={inp} value={form.ip_address} onChange={set('ip_address')} required placeholder="192.168.1.1" />
                  </div>
                  <div className="form-group">
                    <label>Hostname</label>
                    <input style={inp} value={form.hostname||''} onChange={set('hostname')} placeholder="server01.local" />
                  </div>
                  <div className="form-group">
                    <label>Asset Type (Technical)</label>
                    <select style={sel} value={form.asset_type} onChange={set('asset_type')}>
                      {TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Asset Category (ISO 27001)</label>
                    <select style={sel} value={form.asset_category} onChange={set('asset_category')}>
                      {ASSET_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Criticality</label>
                    <select style={sel} value={form.criticality} onChange={set('criticality')}>
                      {CRIT.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select style={sel} value={form.status} onChange={set('status')}>
                      {STATUS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Asset Value ($)</label>
                    <input style={inp} type="number" value={form.asset_value} onChange={set('asset_value')} />
                  </div>
                  <div className="form-group">
                    <label>Location</label>
                    <input style={inp} value={form.location||''} onChange={set('location')} placeholder="DC-1 Rack A3" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Tags</label>
                  <TagInput value={form.tags || []} onChange={tags => setForm(p => ({ ...p, tags }))} />
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea style={{ ...inp, minHeight:60, resize:'vertical' }} value={form.notes||''} onChange={set('notes')} rows={2} />
                </div>
              </div>
            )}

            {/* ISO 27001 Classification */}
            {tab === 'iso' && (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div className="form-group">
                  <label>Information Classification (Annex A 5.12)</label>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:6 }}>
                    {CLASSIFICATIONS.map(c => (
                      <label key={c.id} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 12px',
                                                   borderRadius:8, cursor:'pointer',
                                                   background: form.classification === c.id ? c.bg : 'var(--surface3)',
                                                   border:`1px solid ${form.classification === c.id ? c.color : 'var(--border2)'}`,
                                                   transition:'all 0.15s' }}>
                        <input type="radio" name="classification" value={c.id}
                          checked={form.classification === c.id}
                          onChange={() => setForm(p => ({ ...p, classification: c.id }))}
                          style={{ marginTop:2, accentColor:c.color }} />
                        <div>
                          <div style={{ fontSize:13, fontWeight:700, color:c.color }}>{c.label}</div>
                          <div style={{ fontSize:11, color:'var(--text3)', marginTop:2, lineHeight:1.4 }}>{c.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Data Types Processed / Stored (Annex A 5.9)</label>
                  <div style={{ marginTop:6 }}>
                    <DataTypesInput
                      value={form.data_types || []}
                      onChange={data_types => setForm(p => ({ ...p, data_types }))} />
                  </div>
                </div>

                {form.status === 'decommissioned' && (
                  <div className="form-group">
                    <label>Disposal / Transfer Notes (Annex A 7.14)</label>
                    <textarea style={{ ...inp, minHeight:70, resize:'vertical' }}
                      value={form.disposal_notes||''}
                      onChange={set('disposal_notes')}
                      placeholder="Document how this asset was securely disposed of or transferred..." />
                  </div>
                )}
              </div>
            )}

            {/* Ownership & Review */}
            {tab === 'review' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div className="form-group">
                    <label>Asset Owner (Accountable — Annex A 5.9)</label>
                    <input style={inp} value={form.owner||''} onChange={set('owner')} placeholder="Name or team accountable for the asset" />
                  </div>
                  <div className="form-group">
                    <label>Asset Custodian (Day-to-day management)</label>
                    <input style={inp} value={form.custodian||''} onChange={set('custodian')} placeholder="Person responsible for daily management" />
                  </div>
                  <div className="form-group" style={{ gridColumn:'span 2' }}>
                    <label>Department</label>
                    <input style={inp} value={form.department||''} onChange={set('department')} placeholder="IT, Finance, HR..." />
                  </div>
                </div>

                <div style={{ padding:'12px 14px', background:'var(--surface3)', borderRadius:8,
                               border:'1px solid var(--border2)', fontSize:12, color:'var(--text3)', lineHeight:1.6 }}>
                  <strong style={{ color:'var(--text2)' }}>ISO 27001 Annex A 5.9</strong> requires the asset inventory to be
                  reviewed periodically to ensure it remains accurate. Set a review date to track compliance.
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                  <div className="form-group">
                    <label>Next Review Date</label>
                    <input style={inp} type="date" value={form.review_date||''} onChange={set('review_date')} />
                  </div>
                  <div className="form-group">
                    <label>Last Reviewed Date</label>
                    <input style={inp} type="date" value={form.last_reviewed_at||''} onChange={set('last_reviewed_at')} />
                  </div>
                  <div className="form-group">
                    <label>Reviewed By</label>
                    <input style={inp} value={form.reviewed_by||''} onChange={set('reviewed_by')} placeholder="Name or role" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Asset</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Main Assets Component ─────────────────────────────────────── */
export default function Assets() {
  const { user }  = useContext(AuthContext);
  const isAdmin   = user?.role === 'admin';
  const canEdit   = ['admin','analyst'].includes(user?.role);

  const [assets,         setAssets]        = useState([]);
  const [total,          setTotal]         = useState(0);
  const [page,           setPage]          = useState(1);
  const [search,         setSearch]        = useState('');
  const [criticality,    setCrit]          = useState('');
  const [status,         setStatus]        = useState('active');
  const [classFilter,    setClassFilter]   = useState('');
  const [categoryFilter, setCategoryFilter]= useState('');
  const [modal,          setModal]         = useState(null);
  const [detailAsset,    setDetailAsset]   = useState(null);
  const [histAsset,      setHistAsset]     = useState(null);
  const [loading,        setLoading]       = useState(true);
  const [stats,          setStats]         = useState(null);

  const loadStats = useCallback(() => {
    api.get('/assets/stats').then(r => setStats(r.data)).catch(console.error);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/assets', { params: { page, limit:50, search, criticality, status, classification: classFilter, category: categoryFilter } })
      .then(r => { setAssets(r.data.data); setTotal(r.data.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, search, criticality, status, classFilter, categoryFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadStats(); }, [loadStats]);

  const deleteAsset = async id => {
    if (!window.confirm('Permanently delete this asset and all its vulnerabilities, ports, and risks? This cannot be undone.')) return;
    try { await api.delete(`/assets/${id}`); load(); loadStats(); }
    catch(ex) { alert(ex.response?.data?.error || 'Delete failed'); }
  };

  const exportCSV = () => {
    const headers = ['IP Address','Hostname','Classification','Category','Asset Type','Criticality','Owner','Custodian','Department','Location','Asset Value','Review Date','Status','Open Vulns','Critical Vulns','Tags'];
    const rows = assets.map(a => [
      a.ip_address, a.hostname||'', a.classification||'', a.asset_category||'',
      a.asset_type||'', a.criticality||'', a.owner||'', a.custodian||'',
      a.department||'', a.location||'', a.asset_value||'',
      a.review_date ? a.review_date.slice(0,10) : '', a.status||'',
      a.open_vulns||0, a.critical_vulns||0,
      (a.tags||[]).join('; '),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type:'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url;
    a.download = `asset-register-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const reviewOverdueCount = assets.filter(a => isOverdue(a.review_date)).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Asset Inventory</div>
          <div className="page-subtitle">ISO 27001 Annex A 5.9 — {total} assets in register</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-secondary" onClick={exportCSV} title="Export asset register to CSV">⬇ Export CSV</button>
          {canEdit && <button className="btn btn-primary" onClick={() => setModal({})}>+ Add Asset</button>}
        </div>
      </div>

      {/* ISO 27001 Classification Stats */}
      {stats && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:20 }}>
          {CLASSIFICATIONS.map(c => {
            const count = stats.by_classification?.[c.id] || 0;
            return (
              <div key={c.id}
                style={{ background:'var(--surface2)', border:`1px solid ${classFilter===c.id ? c.color : 'var(--border1)'}`,
                          borderRadius:10, padding:'12px 16px', cursor:'pointer',
                          borderLeft:`4px solid ${c.color}`,
                          transition:'border 0.15s' }}
                onClick={() => setClassFilter(f => f===c.id ? '' : c.id)}>
                <div style={{ fontSize:20, fontWeight:800, color:c.color }}>{count}</div>
                <div style={{ fontSize:11, fontWeight:600, color:c.color, marginTop:2 }}>{c.label}</div>
                <div style={{ fontSize:10, color:'var(--text3)', marginTop:1 }}>assets</div>
              </div>
            );
          })}
          <div style={{ background:'var(--surface2)', border:`1px solid ${reviewOverdueCount > 0 ? '#ef4444' : 'var(--border1)'}`,
                          borderRadius:10, padding:'12px 16px', borderLeft:`4px solid ${reviewOverdueCount > 0 ? '#ef4444' : '#6b7280'}` }}>
            <div style={{ fontSize:20, fontWeight:800, color: reviewOverdueCount > 0 ? '#ef4444' : 'var(--text3)' }}>{reviewOverdueCount}</div>
            <div style={{ fontSize:11, fontWeight:600, color: reviewOverdueCount > 0 ? '#ef4444' : 'var(--text3)', marginTop:2 }}>Review Overdue</div>
            <div style={{ fontSize:10, color:'var(--text3)', marginTop:1 }}>Annex A 5.9</div>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="filter-bar" style={{ flexWrap:'wrap', gap:8 }}>
        <input className="search-input" placeholder="Search IP, hostname, owner, department..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <select className="filter-select" value={classFilter} onChange={e => { setClassFilter(e.target.value); setPage(1); }}>
          <option value="">All Classifications</option>
          {CLASSIFICATIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select className="filter-select" value={criticality} onChange={e => { setCrit(e.target.value); setPage(1); }}>
          <option value="">All Criticality</option>
          {CRIT.map(c => <option key={c}>{c}</option>)}
        </select>
        <select className="filter-select" value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}>
          <option value="">All Categories</option>
          {ASSET_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
        </select>
        <select className="filter-select" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {STATUS.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="card" style={{ padding:0 }}>
        <div className="table-wrap">
          {loading ? <div className="empty-state"><div className="spinner" /></div> :
          assets.length === 0 ? <div className="empty-state"><div className="empty-icon">🖥</div><p>No assets found</p></div> :
          <table>
            <thead>
              <tr>
                <th>Classification</th>
                <th>IP Address</th>
                <th>Hostname</th>
                <th>Category</th>
                <th>Criticality</th>
                <th>Owner</th>
                <th>Custodian</th>
                <th>Vulns</th>
                <th>Review Due</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assets.map(a => {
                const overdue = isOverdue(a.review_date);
                const catObj  = cat(a.asset_category);
                return (
                  <tr key={a.id} style={{ cursor:'pointer' }} onClick={() => setDetailAsset(a)}>
                    <td onClick={e => e.stopPropagation()}>
                      <ClassBadge classification={a.classification} />
                    </td>
                    <td className="mono" style={{ color:'var(--info)' }}>{a.ip_address}</td>
                    <td className="mono">{a.hostname || <span className="text-dim">—</span>}</td>
                    <td>
                      <span style={{ fontSize:12, color:'var(--text2)' }}>
                        {catObj.icon} {catObj.label}
                      </span>
                    </td>
                    <td>
                      <span style={{ color:critColor[a.criticality], fontWeight:600, fontSize:12 }}>
                        {a.criticality}
                      </span>
                    </td>
                    <td style={{ fontSize:12 }}>{a.owner || <span className="text-dim">—</span>}</td>
                    <td style={{ fontSize:12 }}>{a.custodian || <span className="text-dim">—</span>}</td>
                    <td>
                      {a.open_vulns > 0
                        ? <span style={{ color:'var(--high)', fontWeight:600 }}>{a.open_vulns}{a.critical_vulns > 0 && <span style={{ color:'var(--critical)', marginLeft:4 }}>({a.critical_vulns})</span>}</span>
                        : <span className="text-dim">0</span>}
                    </td>
                    <td>
                      {a.review_date ? (
                        <span style={{ fontSize:12, fontWeight: overdue ? 600 : 400,
                                        color: overdue ? '#ef4444' : 'var(--text2)' }}>
                          {overdue && '⚠ '}{fmtD(a.review_date)}
                        </span>
                      ) : <span className="text-dim">Not set</span>}
                    </td>
                    <td>
                      <span className={`status-dot dot-${a.status==='active'?'completed':'pending'}`} />
                      {a.status}
                    </td>
                    <td style={{ display:'flex', gap:4 }} onClick={e => e.stopPropagation()}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setHistAsset(a)} title="Change history">📜</button>
                      {canEdit && <button className="btn btn-secondary btn-sm" onClick={() => setModal(a)}>Edit</button>}
                      {isAdmin && <button className="btn btn-danger btn-sm" onClick={() => deleteAsset(a.id)}>Del</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>}
        </div>
      </div>

      <div className="pagination">
        <span className="page-info">{total} total</span>
        {Array.from({ length: Math.ceil(total/50) }, (_,i) => i+1).map(p => (
          <button key={p} className={`page-btn ${p===page?'active':''}`} onClick={() => setPage(p)}>{p}</button>
        ))}
      </div>

      {detailAsset && (
        <AssetDetailModal
          asset={detailAsset}
          canEdit={canEdit}
          onClose={() => setDetailAsset(null)}
          onEdit={() => setModal(detailAsset)} />
      )}
      {modal !== null && (
        <AssetModal
          asset={modal?.id ? modal : null}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); loadStats(); }} />
      )}
      {histAsset && <AssetHistoryModal asset={histAsset} onClose={() => setHistAsset(null)} />}
    </div>
  );
}
