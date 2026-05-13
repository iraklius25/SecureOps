import React, { useState, useEffect, useRef, useContext } from 'react';
import { api, AuthContext } from '../App';

/* ── Constants ──────────────────────────────────────────────────── */

const FRAMEWORKS = [
  { id: 'ISO27001', label: 'ISO 27001:2022', desc: 'Information Security Management System', color: '#3b82f6' },
  { id: 'NISTCSF',  label: 'NIST CSF 2.0',   desc: 'Cybersecurity Framework',              color: '#10b981' },
  { id: 'ISO42001', label: 'ISO 42001:2023',  desc: 'AI Management System',                color: '#8b5cf6' },
  { id: 'CUSTOM',   label: 'Custom',          desc: 'Custom program',                      color: '#f59e0b' },
];

const PHASES       = ['planning','gap_analysis','implementation','monitoring','certification','review'];
const PHASE_LABELS = { planning:'Planning', gap_analysis:'Gap Analysis', implementation:'Implementation', monitoring:'Monitoring', certification:'Certification', review:'Review' };
const PHASE_COLORS = { planning:'#6b7280', gap_analysis:'#f59e0b', implementation:'#3b82f6', monitoring:'#10b981', certification:'#8b5cf6', review:'#06b6d4' };
const PRIORITIES   = ['critical','high','medium','low'];
const TASK_STATUSES= ['open','in_progress','completed','cancelled'];
const DOC_CATS     = ['policy','procedure','standard','guideline','template','raci','roadmap','report','presentation','training','other'];
const CTRL_STATUSES= ['not_started','in_progress','implemented','not_applicable'];
const EFFECTIVENESS= ['effective','partially_effective','ineffective','not_tested','not_applicable'];
const REVIEW_TYPES = ['management_review','internal_audit','external_audit','surveillance'];

const PC = { critical:'#ef4444', high:'#f97316', medium:'#f59e0b', low:'#6b7280' };
const TC = { open:'#6b7280', in_progress:'#3b82f6', completed:'#10b981', cancelled:'#9ca3af' };
const DC = { draft:'#6b7280', review:'#f59e0b', approved:'#3b82f6', published:'#10b981', retired:'#9ca3af' };
const CC = { not_started:'#6b7280', in_progress:'#3b82f6', implemented:'#10b981', not_applicable:'#9ca3af' };
const EC = { effective:'#10b981', partially_effective:'#f59e0b', ineffective:'#ef4444', not_tested:'#6b7280', not_applicable:'#9ca3af' };
const RC = { planned:'#6b7280', in_progress:'#3b82f6', completed:'#10b981', cancelled:'#9ca3af' };

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}
function fmtBytes(b) {
  if (!b) return '';
  if (b < 1024)       return `${b} B`;
  if (b < 1048576)    return `${(b/1024).toFixed(1)} KB`;
  return `${(b/1048576).toFixed(1)} MB`;
}
function isOverdue(d) { return d && new Date(d) < new Date(); }
function daysLeft(d) {
  if (!d) return null;
  return Math.ceil((new Date(d) - new Date()) / 86400000);
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function humanize(s) { return s ? s.replace(/_/g, ' ') : ''; }

/* ── Style helpers ────────────────────────────────────────────── */

const badge = (color) => ({
  display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:12,
  fontSize:11, fontWeight:600, background:`${color}20`, color, textTransform:'capitalize', whiteSpace:'nowrap',
});
const card = {
  background:'var(--surface2)', border:'1px solid var(--border1)', borderRadius:12, padding:20,
};
const tbl  = { width:'100%', borderCollapse:'collapse', fontSize:13 };
const th   = { textAlign:'left', padding:'8px 12px', borderBottom:'1px solid var(--border1)', color:'var(--text3)', fontWeight:600, fontSize:11, textTransform:'uppercase', letterSpacing:'0.05em' };
const td   = { padding:'10px 12px', borderBottom:'1px solid var(--border1)', color:'var(--text1)', verticalAlign:'middle' };
const inp  = { width:'100%', background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:6, padding:'8px 10px', color:'var(--text1)', fontSize:13, boxSizing:'border-box' };
const sel  = { background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:6, padding:'8px 10px', color:'var(--text1)', fontSize:13 };
const btn  = (v='default') => {
  const vs = {
    default: { background:'var(--surface3)', border:'1px solid var(--border2)', color:'var(--text1)' },
    primary: { background:'var(--accent)', border:'none', color:'#fff' },
    danger:  { background:'#ef444422', border:'1px solid #ef4444', color:'#ef4444' },
  };
  return { ...vs[v], borderRadius:6, padding:'7px 14px', cursor:'pointer', fontSize:13, fontWeight:500 };
};

/* ── Programs Tab ─────────────────────────────────────────────── */

function ProgramCard({ prog, onEdit, onDelete, canEdit }) {
  const fw   = FRAMEWORKS.find(f => f.id === prog.framework) || { label: prog.framework, color:'#6b7280' };
  const days = daysLeft(prog.target_date);
  const sc   = prog.status === 'active' ? '#10b981' : prog.status === 'paused' ? '#f59e0b' : '#6b7280';
  return (
    <div style={{ ...card, borderTop:`3px solid ${fw.color}`, display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:10, fontWeight:700, color:fw.color, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>{fw.label}</div>
          <div style={{ fontSize:15, fontWeight:700, color:'var(--text1)' }}>{prog.name}</div>
          {prog.description && <div style={{ fontSize:12, color:'var(--text3)', marginTop:3 }}>{prog.description}</div>}
        </div>
        <span style={{ ...badge(sc), marginLeft:8, flexShrink:0 }}>{prog.status}</span>
      </div>

      <div>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
          <span style={{ fontSize:11, color:'var(--text3)' }}>Completion</span>
          <span style={{ fontSize:13, fontWeight:700, color:fw.color }}>{prog.completion_pct}%</span>
        </div>
        <div style={{ height:6, background:'var(--surface3)', borderRadius:3, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${prog.completion_pct}%`, background:fw.color, borderRadius:3 }} />
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <div>
          <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:3 }}>Phase</div>
          <span style={badge(PHASE_COLORS[prog.phase]||'#6b7280')}>{PHASE_LABELS[prog.phase]||prog.phase}</span>
        </div>
        <div>
          <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:3 }}>Owner</div>
          <div style={{ fontSize:13, color:'var(--text1)' }}>{prog.owner||'—'}</div>
        </div>
        <div>
          <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:3 }}>Target Date</div>
          <div style={{ fontSize:13, color: days !== null && days >= 0 && days < 30 ? '#f59e0b' : days !== null && days < 0 ? '#ef4444' : 'var(--text1)' }}>
            {fmtDate(prog.target_date)}
            {days !== null && days >= 0 && days < 60 ? ` (${days}d)` : ''}
            {days !== null && days < 0 ? ' ⚠ Overdue' : ''}
          </div>
        </div>
        <div>
          <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:3 }}>Updated</div>
          <div style={{ fontSize:12, color:'var(--text3)' }}>{fmtDate(prog.updated_at)}</div>
        </div>
      </div>

      {canEdit && (
        <div style={{ display:'flex', gap:8, paddingTop:8, borderTop:'1px solid var(--border1)' }}>
          <button style={{ ...btn(), padding:'5px 12px', fontSize:12 }} onClick={() => onEdit(prog)}>Edit</button>
          <button style={{ ...btn('danger'), padding:'5px 12px', fontSize:12 }} onClick={() => onDelete(prog.id)}>Delete</button>
        </div>
      )}
    </div>
  );
}

function ProgramForm({ prog, onSave, onCancel }) {
  const blank = { framework:'ISO27001', name:'', description:'', phase:'planning', owner:'', target_date:'', completion_pct:0, status:'active' };
  const [form, setForm] = useState(prog ? { ...prog, target_date: prog.target_date?.slice(0,10)||'' } : blank);
  const [err, setErr]   = useState('');
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault(); setErr('');
    try {
      if (prog) await api.put(`/grc/programs/${prog.id}`, form);
      else      await api.post('/grc/programs', form);
      onSave();
    } catch (ex) { setErr(ex.response?.data?.error || 'Error saving program'); }
  };

  return (
    <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {err && <div style={{ color:'#ef4444', fontSize:13 }}>{err}</div>}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div className="form-group">
          <label>Framework</label>
          <select style={sel} value={form.framework} onChange={set('framework')}>
            {FRAMEWORKS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Status</label>
          <select style={sel} value={form.status} onChange={set('status')}>
            {['active','paused','completed','cancelled'].map(s => <option key={s} value={s}>{cap(s)}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label>Program Name *</label>
        <input style={inp} value={form.name} onChange={set('name')} required placeholder="e.g. ISO 27001 Implementation 2026" />
      </div>
      <div className="form-group">
        <label>Description</label>
        <textarea style={{ ...inp, height:68, resize:'vertical' }} value={form.description} onChange={set('description')} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
        <div className="form-group">
          <label>Phase</label>
          <select style={sel} value={form.phase} onChange={set('phase')}>
            {PHASES.map(p => <option key={p} value={p}>{PHASE_LABELS[p]}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Owner</label>
          <input style={inp} value={form.owner} onChange={set('owner')} placeholder="CISO / Name" />
        </div>
        <div className="form-group">
          <label>Target Date</label>
          <input type="date" style={inp} value={form.target_date} onChange={set('target_date')} />
        </div>
      </div>
      <div className="form-group">
        <label>Completion — {form.completion_pct}%</label>
        <input type="range" min={0} max={100} value={form.completion_pct} onChange={set('completion_pct')} style={{ width:'100%', accentColor:'var(--accent)' }} />
      </div>
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
        <button type="button" style={btn()} onClick={onCancel}>Cancel</button>
        <button type="submit" style={btn('primary')}>{prog ? 'Update' : 'Create Program'}</button>
      </div>
    </form>
  );
}

function ProgramsTab({ user }) {
  const [programs, setPrograms] = useState([]);
  const [editing,  setEditing]  = useState(null);
  const canEdit = ['admin','analyst'].includes(user?.role);

  const load = async () => { try { const r = await api.get('/grc/programs'); setPrograms(r.data); } catch {} };
  useEffect(() => { load(); }, []);

  const del = async id => {
    if (!window.confirm('Delete this program and all linked data?')) return;
    try { await api.delete(`/grc/programs/${id}`); load(); } catch {}
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ fontSize:18, fontWeight:700, margin:0 }}>Framework Programs</h2>
        {canEdit && <button style={btn('primary')} onClick={() => setEditing('new')}>+ New Program</button>}
      </div>

      {editing && (
        <div style={{ ...card, marginBottom:24 }}>
          <h3 style={{ fontSize:15, fontWeight:700, margin:'0 0 16px' }}>{editing === 'new' ? 'Create Program' : 'Edit Program'}</h3>
          <ProgramForm
            prog={editing === 'new' ? null : editing}
            onSave={() => { setEditing(null); load(); }}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {FRAMEWORKS.map(fw => {
        const progs = programs.filter(p => p.framework === fw.id);
        return (
          <div key={fw.id} style={{ marginBottom:28 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
              <div style={{ width:4, height:20, background:fw.color, borderRadius:2 }} />
              <h3 style={{ fontSize:14, fontWeight:700, margin:0, color:fw.color }}>{fw.label}</h3>
              <span style={{ fontSize:12, color:'var(--text3)' }}>{fw.desc}</span>
              <span style={{ ...badge('#6b7280'), marginLeft:'auto' }}>{progs.length} program{progs.length!==1?'s':''}</span>
            </div>
            {progs.length === 0 ? (
              <div style={{ padding:'16px 20px', background:'var(--surface2)', border:'1px dashed var(--border2)', borderRadius:8, color:'var(--text3)', fontSize:13, textAlign:'center' }}>
                No programs yet
                {canEdit && <> — <button style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:13 }} onClick={() => setEditing('new')}>create one</button></>}
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(310px,1fr))', gap:16 }}>
                {progs.map(p => (
                  <ProgramCard key={p.id} prog={p} canEdit={canEdit} onEdit={setEditing} onDelete={del} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Documents Tab ────────────────────────────────────────────── */

function DocumentsTab({ user }) {
  const [docs,       setDocs]       = useState([]);
  const [programs,   setPrograms]   = useState([]);
  const [filter,     setFilter]     = useState({ category:'', status:'', search:'', framework:'' });
  const [showForm,   setShowForm]   = useState(false);
  const [form,       setForm]       = useState({ program_id:'', title:'', category:'policy', doc_version:'1.0', status:'draft', owner:'', review_date:'', description:'' });
  const [file,       setFile]       = useState(null);
  const [err,        setErr]        = useState('');
  const [busy,       setBusy]       = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [editForm,   setEditForm]   = useState({});
  const [editFile,   setEditFile]   = useState(null);
  const [editErr,    setEditErr]    = useState('');
  const [editBusy,   setEditBusy]   = useState(false);
  const fileRef     = useRef();
  const editFileRef = useRef();
  const canEdit = ['admin','analyst'].includes(user?.role);

  const [viewingDoc,  setViewingDoc]  = useState(null);
  const [viewUrl,     setViewUrl]     = useState('');
  const [viewText,    setViewText]    = useState('');
  const [viewHtml,    setViewHtml]    = useState('');
  const [viewLoading, setViewLoading] = useState(false);

  const openViewer = async doc => {
    setViewingDoc(doc); setViewLoading(true);
    setViewUrl(''); setViewText(''); setViewHtml('');
    try {
      const resp = await api.get(`/grc/documents/${doc.id}/download`, { responseType: 'blob' });
      const blob = resp.data;
      const mime = doc.mimetype || '';
      const name = doc.original_name || '';

      if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
          /\.docx$/i.test(name)) {
        const mammoth     = await import('mammoth');
        const arrayBuffer = await blob.arrayBuffer();
        const result      = await mammoth.convertToHtml({ arrayBuffer });
        setViewHtml(result.value);

      } else if (
        mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        mime === 'application/vnd.ms-excel' ||
        /\.(xlsx|xls)$/i.test(name)
      ) {
        const XLSX        = await import('xlsx');
        const arrayBuffer = await blob.arrayBuffer();
        const wb          = XLSX.read(arrayBuffer, { type: 'array' });
        const parts = wb.SheetNames.map(sheetName => {
          const ws   = wb.Sheets[sheetName];
          const html = XLSX.utils.sheet_to_html(ws, { id: sheetName });
          return `<h3 style="margin:18px 0 8px;font-size:13px;font-weight:700;color:#555;letter-spacing:.04em;text-transform:uppercase">${sheetName}</h3>${html}`;
        });
        setViewHtml(parts.join('<hr style="margin:24px 0;border:none;border-top:1px solid #ddd"/>'));

      } else if (mime?.startsWith('text/') || /\.(txt|csv|json|md|xml|log)$/i.test(name)) {
        setViewText(await blob.text());

      } else {
        setViewUrl(URL.createObjectURL(blob));
      }
    } catch (e) {
      console.error('Viewer error:', e);
      alert('Failed to load document');
      setViewingDoc(null);
    } finally { setViewLoading(false); }
  };

  const closeViewer = () => {
    if (viewUrl) URL.revokeObjectURL(viewUrl);
    setViewUrl(''); setViewText(''); setViewHtml(''); setViewingDoc(null);
  };

  const load = async () => {
    try {
      const [d, p] = await Promise.all([api.get('/grc/documents'), api.get('/grc/programs')]);
      setDocs(d.data); setPrograms(p.data);
    } catch {}
  };
  useEffect(() => { load(); }, []);

  const filtered = docs.filter(d => {
    if (filter.category && d.category !== filter.category) return false;
    if (filter.status   && d.status   !== filter.status)   return false;
    if (filter.search    && !d.title.toLowerCase().includes(filter.search.toLowerCase())) return false;
    if (filter.framework) {
      const prog = programs.find(p => p.id === d.program_id);
      if (!prog || prog.framework !== filter.framework) return false;
    }
    return true;
  });

  const setF = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
      if (file) fd.append('file', file);
      await api.post('/grc/documents', fd, { headers:{ 'Content-Type':'multipart/form-data' } });
      setShowForm(false);
      setForm({ program_id:'', title:'', category:'policy', doc_version:'1.0', status:'draft', owner:'', review_date:'', description:'' });
      setFile(null);
      load();
    } catch (ex) { setErr(ex.response?.data?.error || 'Upload failed'); }
    finally { setBusy(false); }
  };

  const del = async id => {
    if (!window.confirm('Delete this document?')) return;
    try { await api.delete(`/grc/documents/${id}`); load(); } catch {}
  };

  const startEdit = d => {
    setEditingDoc(d);
    setEditForm({ title: d.title, category: d.category, doc_version: d.doc_version, status: d.status, owner: d.owner||'', review_date: d.review_date?.slice(0,10)||'', description: d.description||'' });
    setEditFile(null); setEditErr('');
    setShowForm(false);
  };

  const submitEdit = async e => {
    e.preventDefault(); setEditErr(''); setEditBusy(true);
    try {
      const fd = new FormData();
      Object.entries(editForm).forEach(([k, v]) => fd.append(k, v || ''));
      if (editFile) fd.append('file', editFile);
      await api.put(`/grc/documents/${editingDoc.id}`, fd, { headers:{ 'Content-Type':'multipart/form-data' } });
      setEditingDoc(null); setEditFile(null); load();
    } catch (ex) { setEditErr(ex.response?.data?.error || 'Save failed'); }
    finally { setEditBusy(false); }
  };

  const setEF = k => e => setEditForm(p => ({ ...p, [k]: e.target.value }));

  const approve = async (id) => {
    try {
      await api.post(`/grc/documents/${id}/approve`);
      load();
    } catch (ex) { alert(ex.response?.data?.error || 'Approve failed'); }
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 style={{ fontSize:18, fontWeight:700, margin:0 }}>Document Library</h2>
        {canEdit && <button style={btn('primary')} onClick={() => { setShowForm(s => !s); setEditingDoc(null); }}>+ Add Document</button>}
      </div>

      {/* Edit document panel */}
      {editingDoc && canEdit && (
        <div style={{ ...card, marginBottom:20, borderLeft:'3px solid var(--accent)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <h3 style={{ fontSize:15, fontWeight:700, margin:0 }}>Edit Document</h3>
            <button style={btn()} onClick={() => setEditingDoc(null)}>✕ Cancel</button>
          </div>
          <form onSubmit={submitEdit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {editErr && <div style={{ color:'#ef4444', fontSize:13 }}>{editErr}</div>}
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label>Title *</label>
                <input style={inp} value={editForm.title||''} onChange={setEF('title')} required />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select style={sel} value={editForm.category||'policy'} onChange={setEF('category')}>
                  {DOC_CATS.map(c => <option key={c} value={c}>{cap(c)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Version</label>
                <input style={inp} value={editForm.doc_version||''} onChange={setEF('doc_version')} placeholder="1.0" />
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label>Status</label>
                <select style={sel} value={editForm.status||'draft'} onChange={setEF('status')}>
                  {['draft','review','approved','published','retired'].map(s => <option key={s} value={s}>{cap(s)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Owner</label>
                <input style={inp} value={editForm.owner||''} onChange={setEF('owner')} placeholder="Name / team" />
              </div>
              <div className="form-group">
                <label>Review Date</label>
                <input type="date" style={inp} value={editForm.review_date||''} onChange={setEF('review_date')} />
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea style={{ ...inp, height:52, resize:'vertical' }} value={editForm.description||''} onChange={setEF('description')} />
            </div>
            <div className="form-group">
              <label>
                Replace File <span style={{ fontWeight:400, color:'var(--text3)', fontSize:11 }}>(leave blank to keep existing {editingDoc.original_name ? `"${editingDoc.original_name}"` : 'file'})</span>
              </label>
              <input ref={editFileRef} type="file" style={{ fontSize:13, color:'var(--text1)' }} onChange={e => setEditFile(e.target.files[0])} />
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button type="button" style={btn()} onClick={() => setEditingDoc(null)}>Cancel</button>
              <button type="submit" style={btn('primary')} disabled={editBusy}>{editBusy ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </form>
        </div>
      )}

      {showForm && canEdit && (
        <div style={{ ...card, marginBottom:20 }}>
          <h3 style={{ fontSize:15, fontWeight:700, margin:'0 0 14px' }}>Add Document</h3>
          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {err && <div style={{ color:'#ef4444', fontSize:13 }}>{err}</div>}
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label>Title *</label>
                <input style={inp} value={form.title} onChange={setF('title')} required placeholder="e.g. Information Security Policy" />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select style={sel} value={form.category} onChange={setF('category')}>
                  {DOC_CATS.map(c => <option key={c} value={c}>{cap(c)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Version</label>
                <input style={inp} value={form.doc_version} onChange={setF('doc_version')} placeholder="1.0" />
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label>Status</label>
                <select style={sel} value={form.status} onChange={setF('status')}>
                  {['draft','review','approved','published','retired'].map(s => <option key={s} value={s}>{cap(s)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Owner</label>
                <input style={inp} value={form.owner} onChange={setF('owner')} placeholder="Name / team" />
              </div>
              <div className="form-group">
                <label>Review Date</label>
                <input type="date" style={inp} value={form.review_date} onChange={setF('review_date')} />
              </div>
              <div className="form-group">
                <label>Program</label>
                <select style={sel} value={form.program_id} onChange={setF('program_id')}>
                  <option value="">— None —</option>
                  {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea style={{ ...inp, height:56, resize:'vertical' }} value={form.description} onChange={setF('description')} />
            </div>
            <div className="form-group">
              <label>File (PDF, DOCX, PPTX, XLSX, PNG…)</label>
              <input ref={fileRef} type="file" style={{ fontSize:13, color:'var(--text1)' }} onChange={e => setFile(e.target.files[0])} />
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button type="button" style={btn()} onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" style={btn('primary')} disabled={busy}>{busy ? 'Uploading…' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <input style={{ ...inp, maxWidth:240 }} placeholder="Search title…" value={filter.search} onChange={e => setFilter(p=>({...p,search:e.target.value}))} />
        <select style={sel} value={filter.category} onChange={e => setFilter(p=>({...p,category:e.target.value}))}>
          <option value="">All categories</option>
          {DOC_CATS.map(c => <option key={c} value={c}>{cap(c)}</option>)}
        </select>
        <select style={sel} value={filter.status} onChange={e => setFilter(p=>({...p,status:e.target.value}))}>
          <option value="">All statuses</option>
          {['draft','review','approved','published','retired'].map(s => <option key={s} value={s}>{cap(s)}</option>)}
        </select>
        <select style={sel} value={filter.framework} onChange={e => setFilter(p=>({...p,framework:e.target.value}))}>
          <option value="">All programs</option>
          {FRAMEWORKS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <span style={{ marginLeft:'auto', fontSize:13, color:'var(--text3)' }}>{filtered.length} document{filtered.length!==1?'s':''}</span>
      </div>

      <div style={{ overflowX:'auto' }}>
        <table style={tbl}>
          <thead>
            <tr>{['Title','Program','Category','Ver.','Status','Owner','Review Date','File','Actions'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ ...td, textAlign:'center', color:'var(--text3)', padding:32 }}>No documents found</td></tr>
            )}
            {filtered.map(d => (
              <tr key={d.id}>
                <td style={td}>
                  <div style={{ fontWeight:600 }}>{d.title}</div>
                  {d.description && <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{d.description.slice(0,80)}{d.description.length>80?'…':''}</div>}
                  {d.approved_at && <div style={{ fontSize:10, color:'#10b981', marginTop:2 }}>✓ Approved {fmtDate(d.approved_at)} by {d.approved_by_username||'—'}</div>}
                </td>
                <td style={td}>{(() => {
                  const prog = programs.find(p => p.id === d.program_id);
                  const fw   = prog ? FRAMEWORKS.find(f => f.id === prog.framework) : null;
                  return fw
                    ? <span style={badge(fw.color)}>{fw.label}</span>
                    : <span style={{ color:'var(--text3)', fontSize:12 }}>—</span>;
                })()}</td>
                <td style={td}><span style={badge('#6b7280')}>{d.category}</span></td>
                <td style={td}><span style={{ fontSize:12, color:'var(--text3)' }}>v{d.doc_version}</span></td>
                <td style={td}><span style={badge(DC[d.status]||'#6b7280')}>{d.status}</span></td>
                <td style={td}>{d.owner||'—'}</td>
                <td style={td}>
                  {d.review_date
                    ? <span style={{ color: isOverdue(d.review_date)?'#ef4444':'var(--text1)', fontSize:13 }}>{fmtDate(d.review_date)}</span>
                    : '—'}
                </td>
                <td style={{ ...td, whiteSpace:'nowrap' }}>
                  {d.stored_name ? (
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      <button className="btn btn-secondary btn-sm" style={{ fontSize:12 }}
                        onClick={() => openViewer(d)}>
                        👁 View
                      </button>
                      <button className="btn btn-secondary btn-sm" style={{ fontSize:12 }} onClick={async () => {
                          try {
                            const resp = await api.get(`/grc/documents/${d.id}/download`, { responseType: 'blob' });
                            const url  = URL.createObjectURL(resp.data);
                            const a    = document.createElement('a');
                            a.href     = url;
                            a.download = d.original_name || 'document';
                            a.click();
                            URL.revokeObjectURL(url);
                          } catch { alert('Download failed'); }
                        }}>⬇ {fmtBytes(d.file_size)}</button>
                    </div>
                  ) : <span style={{ color:'var(--text3)', fontSize:12 }}>No file</span>}
                </td>
                <td style={td}>
                  {canEdit && (
                    <div style={{ display:'flex', gap:6 }}>
                      {d.status !== 'approved' && <button style={{ ...btn(), padding:'4px 10px', fontSize:12, color:'#10b981', border:'1px solid #10b981' }} onClick={() => approve(d.id)}>✓ Approve</button>}
                      <button style={{ ...btn(), padding:'4px 10px', fontSize:12 }} onClick={() => startEdit(d)}>Edit</button>
                      <button style={{ ...btn('danger'), padding:'4px 10px', fontSize:12 }} onClick={() => del(d.id)}>Delete</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Document Viewer Modal */}
      {viewingDoc && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeViewer()}
          style={{ zIndex: 10000 }}>
          <div style={{
            background: 'var(--bg2)', borderRadius: 'var(--radius)',
            width: '90vw', maxWidth: 1100, maxHeight: '92vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            boxShadow: '0 16px 64px rgba(0,0,0,0.6)',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 18px', borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {viewingDoc.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                  {viewingDoc.original_name} · {fmtBytes(viewingDoc.file_size)}
                  {viewingDoc.mimetype && <> · <span className="mono">{viewingDoc.mimetype}</span></>}
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" style={{ fontSize: 12, flexShrink: 0 }}
                onClick={async () => {
                  try {
                    const resp = await api.get(`/grc/documents/${viewingDoc.id}/download`, { responseType: 'blob' });
                    const url  = URL.createObjectURL(resp.data);
                    const a    = document.createElement('a');
                    a.href     = url;
                    a.download = viewingDoc.original_name || 'document';
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch { alert('Download failed'); }
                }}>⬇ Download</button>
              <button className="modal-close" onClick={closeViewer}>✕</button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg3)', position: 'relative', minHeight: 200 }}>
              {viewLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
                  <div className="spinner" />
                </div>
              ) : viewingDoc.mimetype === 'application/pdf' ? (
                <iframe
                  src={viewUrl}
                  title={viewingDoc.title}
                  style={{ width: '100%', height: '80vh', border: 'none', display: 'block' }}
                />
              ) : viewingDoc.mimetype?.startsWith('image/') ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, minHeight: 300 }}>
                  <img
                    src={viewUrl}
                    alt={viewingDoc.title}
                    style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: 4, boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}
                  />
                </div>
              ) : viewText ? (
                <pre style={{
                  margin: 0, padding: 24, fontSize: 13, lineHeight: 1.6,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  color: 'var(--text1)', fontFamily: 'monospace', overflowX: 'auto',
                }}>
                  {viewText}
                </pre>
              ) : viewHtml ? (
                <div style={{ background: '#fff', minHeight: '80vh', padding: '32px 40px', overflowX: 'auto' }}>
                  <style>{`
                    .doc-body table { border-collapse: collapse; width: 100%; margin-bottom: 16px; font-size: 13px; }
                    .doc-body td, .doc-body th { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
                    .doc-body th { background: #f0f0f0; font-weight: 600; }
                    .doc-body p { margin: 0 0 10px; line-height: 1.6; color: #222; font-size: 14px; }
                    .doc-body h1,.doc-body h2,.doc-body h3,.doc-body h4 { margin: 18px 0 8px; color: #111; }
                    .doc-body ul,.doc-body ol { margin: 0 0 10px 24px; color: #222; font-size: 14px; }
                    .doc-body strong { font-weight: 700; }
                    .doc-body em { font-style: italic; }
                  `}</style>
                  <div className="doc-body" dangerouslySetInnerHTML={{ __html: viewHtml }} />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 16 }}>
                  <div style={{ fontSize: 48 }}>📄</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text1)' }}>
                    Preview not available for this format
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', maxWidth: 380 }}>
                    <strong>{viewingDoc.original_name}</strong> is a{' '}
                    {/\.pptx?$/i.test(viewingDoc.original_name || '') ? 'PowerPoint presentation' :
                     /\.docm$/i.test(viewingDoc.original_name || '') ? 'macro-enabled Word document' :
                     viewingDoc.mimetype || 'binary file'}{' '}
                    that cannot be rendered in the browser.
                    Download it to open in the appropriate application.
                  </div>
                  <button className="btn btn-primary" style={{ marginTop: 8 }}
                    onClick={async () => {
                      try {
                        const resp = await api.get(`/grc/documents/${viewingDoc.id}/download`, { responseType: 'blob' });
                        const url  = URL.createObjectURL(resp.data);
                        const a    = document.createElement('a');
                        a.href     = url;
                        a.download = viewingDoc.original_name || 'document';
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch { alert('Download failed'); }
                    }}>⬇ Download File</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Controls Tab ─────────────────────────────────────────────── */

function ControlsTab({ user }) {
  const [controls, setControls] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [filter,   setFilter]   = useState({ framework:'', status:'', search:'' });
  const [editing,  setEditing]  = useState(null);
  const blank = { program_id:'', control_ref:'', title:'', description:'', category:'', framework:'ISO27001', owner:'', status:'not_started', effectiveness:'not_tested', last_tested:'', next_review:'', notes:'' };
  const [form, setForm] = useState(blank);
  const [err,  setErr]  = useState('');
  const canEdit = ['admin','analyst'].includes(user?.role);

  const load = async () => {
    try {
      const [c, p] = await Promise.all([api.get('/grc/controls'), api.get('/grc/programs')]);
      setControls(c.data); setPrograms(p.data);
    } catch {}
  };
  useEffect(() => { load(); }, []);

  const filtered = controls.filter(c => {
    if (filter.framework && c.framework !== filter.framework) return false;
    if (filter.status    && c.status    !== filter.status)    return false;
    if (filter.search && !`${c.title}${c.control_ref}`.toLowerCase().includes(filter.search.toLowerCase())) return false;
    return true;
  });

  const setF  = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const startEdit = c => { setEditing(c.id); setForm({ ...c, last_tested: c.last_tested?.slice(0,10)||'', next_review: c.next_review?.slice(0,10)||'' }); };

  const submit = async e => {
    e.preventDefault(); setErr('');
    try {
      if (editing === 'new') await api.post('/grc/controls', form);
      else                   await api.put(`/grc/controls/${editing}`, form);
      setEditing(null); load();
    } catch (ex) { setErr(ex.response?.data?.error || 'Error'); }
  };

  const del = async id => {
    if (!window.confirm('Delete this control?')) return;
    try { await api.delete(`/grc/controls/${id}`); load(); } catch {}
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 style={{ fontSize:18, fontWeight:700, margin:0 }}>Control Register</h2>
        {canEdit && <button style={btn('primary')} onClick={() => { setForm(blank); setEditing('new'); }}>+ Add Control</button>}
      </div>

      {editing && (
        <div style={{ ...card, marginBottom:20 }}>
          <h3 style={{ fontSize:15, fontWeight:700, margin:'0 0 14px' }}>{editing==='new' ? 'New Control' : 'Edit Control'}</h3>
          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {err && <div style={{ color:'#ef4444', fontSize:13 }}>{err}</div>}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 2fr', gap:12 }}>
              <div className="form-group">
                <label>Framework</label>
                <select style={sel} value={form.framework} onChange={setF('framework')}>
                  {FRAMEWORKS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Control Ref *</label>
                <input style={inp} value={form.control_ref} onChange={setF('control_ref')} required placeholder="e.g. A.5.1" />
              </div>
              <div className="form-group">
                <label>Title *</label>
                <input style={inp} value={form.title} onChange={setF('title')} required placeholder="Control title" />
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea style={{ ...inp, height:56, resize:'vertical' }} value={form.description} onChange={setF('description')} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label>Owner</label>
                <input style={inp} value={form.owner} onChange={setF('owner')} />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select style={sel} value={form.status} onChange={setF('status')}>
                  {CTRL_STATUSES.map(s => <option key={s} value={s}>{humanize(s)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Effectiveness</label>
                <select style={sel} value={form.effectiveness} onChange={setF('effectiveness')}>
                  {EFFECTIVENESS.map(e => <option key={e} value={e}>{humanize(e)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Category</label>
                <input style={inp} value={form.category} onChange={setF('category')} placeholder="e.g. Access Control" />
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label>Last Tested</label>
                <input type="date" style={inp} value={form.last_tested} onChange={setF('last_tested')} />
              </div>
              <div className="form-group">
                <label>Next Review</label>
                <input type="date" style={inp} value={form.next_review} onChange={setF('next_review')} />
              </div>
              <div className="form-group">
                <label>Program</label>
                <select style={sel} value={form.program_id} onChange={setF('program_id')}>
                  <option value="">— None —</option>
                  {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea style={{ ...inp, height:48, resize:'vertical' }} value={form.notes} onChange={setF('notes')} />
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button type="button" style={btn()} onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" style={btn('primary')}>{editing==='new'?'Add Control':'Update'}</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <input style={{ ...inp, maxWidth:240 }} placeholder="Search controls…" value={filter.search} onChange={e => setFilter(p=>({...p,search:e.target.value}))} />
        <select style={sel} value={filter.framework} onChange={e => setFilter(p=>({...p,framework:e.target.value}))}>
          <option value="">All frameworks</option>
          {FRAMEWORKS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <select style={sel} value={filter.status} onChange={e => setFilter(p=>({...p,status:e.target.value}))}>
          <option value="">All statuses</option>
          {CTRL_STATUSES.map(s => <option key={s} value={s}>{humanize(s)}</option>)}
        </select>
        <span style={{ marginLeft:'auto', fontSize:13, color:'var(--text3)' }}>{filtered.length} controls</span>
      </div>

      <div style={{ overflowX:'auto' }}>
        <table style={tbl}>
          <thead>
            <tr>{['Ref','Title','Framework','Owner','Status','Effectiveness','Next Review',''].map(h=><th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ ...td, textAlign:'center', color:'var(--text3)', padding:32 }}>No controls found</td></tr>
            )}
            {filtered.map(c => (
              <tr key={c.id}>
                <td style={td}><code style={{ fontSize:12, color:'var(--accent)' }}>{c.control_ref}</code></td>
                <td style={td}>
                  <div style={{ fontWeight:500 }}>{c.title}</div>
                  {c.category && <div style={{ fontSize:11, color:'var(--text3)' }}>{c.category}</div>}
                </td>
                <td style={td}><span style={badge((FRAMEWORKS.find(f=>f.id===c.framework)||{color:'#6b7280'}).color)}>{c.framework}</span></td>
                <td style={td}>{c.owner||'—'}</td>
                <td style={td}><span style={badge(CC[c.status]||'#6b7280')}>{humanize(c.status)}</span></td>
                <td style={td}><span style={badge(EC[c.effectiveness]||'#6b7280')}>{humanize(c.effectiveness)}</span></td>
                <td style={td}>
                  {c.next_review
                    ? <span style={{ color: isOverdue(c.next_review)?'#ef4444':'var(--text1)', fontSize:13 }}>{fmtDate(c.next_review)}</span>
                    : '—'}
                </td>
                <td style={td}>
                  {canEdit && (
                    <div style={{ display:'flex', gap:6 }}>
                      <button style={{ ...btn(), padding:'4px 10px', fontSize:12 }} onClick={() => startEdit(c)}>Edit</button>
                      <button style={{ ...btn('danger'), padding:'4px 10px', fontSize:12 }} onClick={() => del(c.id)}>Del</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── NC Detail Panel ──────────────────────────────────────────── */

const NC_TYPE_COLORS = { major_nc:'#ef4444', minor_nc:'#f97316', observation:'#3b82f6', action:'#6b7280' };

function NCDetail({ task, canEdit, onUpdated }) {
  const [ncFields, setNcFields] = useState({
    nc_type:               task.nc_type              || 'action',
    source:                task.source               || 'manual',
    root_cause:            task.root_cause            || '',
    containment_action:    task.containment_action    || '',
    corrective_action:     task.corrective_action     || '',
    verification_evidence: task.verification_evidence || '',
    verification_date:     task.verification_date     ? task.verification_date.slice(0,10) : '',
    recurrence_check_date: task.recurrence_check_date ? task.recurrence_check_date.slice(0,10) : '',
  });
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState('');

  const setF = k => e => setNcFields(p => ({ ...p, [k]: e.target.value }));
  const setC = k => e => setNcFields(p => ({ ...p, [k]: e.target.checked }));

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      await api.put(`/grc/tasks/${task.id}`, { ...task, ...ncFields });
      setMsg('Saved'); onUpdated();
      setTimeout(() => setMsg(''), 2000);
    } catch (ex) { setMsg(ex.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  };

  const ncTypeColor = NC_TYPE_COLORS[ncFields.nc_type] || '#6b7280';

  return (
    <div style={{ padding:'12px 0', fontSize:13 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
        <span style={{ fontWeight:700, fontSize:12, color:'var(--text2)' }}>NC / Action Detail</span>
        <span style={{ ...badge(ncTypeColor), fontSize:11 }}>{humanize(ncFields.nc_type)}</span>
        {msg && <span style={{ fontSize:12, color: msg==='Saved'?'#10b981':'#ef4444', fontWeight:600 }}>{msg}</span>}
        {canEdit && <button style={{ ...btn('primary'), padding:'4px 12px', fontSize:12, marginLeft:'auto' }} onClick={save} disabled={saving}>{saving?'Saving…':'Save NC fields'}</button>}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <div className="form-group">
          <label style={{ fontSize:11, color:'var(--text3)', display:'block', marginBottom:3 }}>NC Type</label>
          <select style={{ ...sel, fontSize:12, width:'100%' }} value={ncFields.nc_type} onChange={setF('nc_type')} disabled={!canEdit}>
            {[['action','Action'],['major_nc','Major NC'],['minor_nc','Minor NC'],['observation','Observation']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label style={{ fontSize:11, color:'var(--text3)', display:'block', marginBottom:3 }}>Source</label>
          <select style={{ ...sel, fontSize:12, width:'100%' }} value={ncFields.source} onChange={setF('source')} disabled={!canEdit}>
            {[['manual','Manual'],['audit','Audit'],['incident','Incident'],['management_review','Management Review']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label style={{ fontSize:11, color:'var(--text3)', display:'block', marginBottom:3 }}>Root Cause</label>
          <textarea style={{ ...inp, fontSize:12, height:60, resize:'vertical' }} value={ncFields.root_cause} onChange={setF('root_cause')} disabled={!canEdit} placeholder="Describe root cause…" />
        </div>
        <div className="form-group">
          <label style={{ fontSize:11, color:'var(--text3)', display:'block', marginBottom:3 }}>Containment Action</label>
          <textarea style={{ ...inp, fontSize:12, height:60, resize:'vertical' }} value={ncFields.containment_action} onChange={setF('containment_action')} disabled={!canEdit} placeholder="Immediate containment steps…" />
        </div>
        <div className="form-group">
          <label style={{ fontSize:11, color:'var(--text3)', display:'block', marginBottom:3 }}>Corrective Action</label>
          <textarea style={{ ...inp, fontSize:12, height:60, resize:'vertical' }} value={ncFields.corrective_action} onChange={setF('corrective_action')} disabled={!canEdit} placeholder="Long-term corrective action…" />
        </div>
        <div className="form-group">
          <label style={{ fontSize:11, color:'var(--text3)', display:'block', marginBottom:3 }}>Verification Evidence</label>
          <textarea style={{ ...inp, fontSize:12, height:60, resize:'vertical' }} value={ncFields.verification_evidence} onChange={setF('verification_evidence')} disabled={!canEdit} placeholder="Evidence of effectiveness…" />
        </div>
        <div className="form-group">
          <label style={{ fontSize:11, color:'var(--text3)', display:'block', marginBottom:3 }}>Verification Date</label>
          <input type="date" style={{ ...inp, fontSize:12 }} value={ncFields.verification_date} onChange={setF('verification_date')} disabled={!canEdit} />
        </div>
        <div className="form-group">
          <label style={{ fontSize:11, color:'var(--text3)', display:'block', marginBottom:3 }}>Recurrence Check Date</label>
          <input type="date" style={{ ...inp, fontSize:12 }} value={ncFields.recurrence_check_date} onChange={setF('recurrence_check_date')} disabled={!canEdit} />
        </div>
      </div>
    </div>
  );
}

/* ── Tasks Tab ────────────────────────────────────────────────── */

function TasksTab({ user }) {
  const [tasks,        setTasks]        = useState([]);
  const [programs,     setPrograms]     = useState([]);
  const [filter,       setFilter]       = useState({ status:'', priority:'', framework:'', search:'' });
  const [showForm,     setShowForm]     = useState(false);
  const [form,         setForm]         = useState({ program_id:'', title:'', description:'', owner:'', due_date:'', priority:'medium', status:'open', framework:'', clause_ref:'' });
  const [err,          setErr]          = useState('');
  const [expandedTask, setExpandedTask] = useState(null);
  const canEdit = ['admin','analyst'].includes(user?.role);

  const load = async () => {
    try {
      const [t, p] = await Promise.all([api.get('/grc/tasks'), api.get('/grc/programs')]);
      setTasks(t.data); setPrograms(p.data);
    } catch {}
  };
  useEffect(() => { load(); }, []);

  const filtered = tasks.filter(t => {
    if (filter.status    && t.status    !== filter.status)    return false;
    if (filter.priority  && t.priority  !== filter.priority)  return false;
    if (filter.framework && t.framework !== filter.framework)  return false;
    if (filter.search && !t.title.toLowerCase().includes(filter.search.toLowerCase())) return false;
    return true;
  });

  const setF = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault(); setErr('');
    try {
      await api.post('/grc/tasks', form);
      setShowForm(false);
      setForm({ program_id:'', title:'', description:'', owner:'', due_date:'', priority:'medium', status:'open', framework:'', clause_ref:'' });
      load();
    } catch (ex) { setErr(ex.response?.data?.error || 'Error'); }
  };

  const changeStatus = async (t, status) => {
    try { await api.put(`/grc/tasks/${t.id}`, { ...t, status }); load(); } catch {}
  };

  const del = async id => {
    if (!window.confirm('Delete task?')) return;
    try { await api.delete(`/grc/tasks/${id}`); load(); } catch {}
  };

  const overdue = filtered.filter(t => t.status !== 'completed' && t.status !== 'cancelled' && isOverdue(t.due_date));
  const sc      = TASK_STATUSES.reduce((a, s) => { a[s] = filtered.filter(t => t.status === s).length; return a; }, {});

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 style={{ fontSize:18, fontWeight:700, margin:0 }}>Action Tracker</h2>
        {canEdit && <button style={btn('primary')} onClick={() => setShowForm(s => !s)}>+ New Task</button>}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Open',        count: sc.open||0,        color:'#6b7280' },
          { label:'In Progress', count: sc.in_progress||0, color:'#3b82f6' },
          { label:'Completed',   count: sc.completed||0,   color:'#10b981' },
          { label:'Overdue',     count: overdue.length,    color:'#ef4444' },
        ].map(s => (
          <div key={s.label} style={{ ...card, textAlign:'center', borderLeft:`3px solid ${s.color}` }}>
            <div style={{ fontSize:26, fontWeight:800, color:s.color }}>{s.count}</div>
            <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {showForm && canEdit && (
        <div style={{ ...card, marginBottom:20 }}>
          <h3 style={{ fontSize:15, fontWeight:700, margin:'0 0 14px' }}>New Task</h3>
          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {err && <div style={{ color:'#ef4444', fontSize:13 }}>{err}</div>}
            <div className="form-group">
              <label>Title *</label>
              <input style={inp} value={form.title} onChange={setF('title')} required placeholder="Action item title" />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label>Priority</label>
                <select style={sel} value={form.priority} onChange={setF('priority')}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{cap(p)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Owner</label>
                <input style={inp} value={form.owner} onChange={setF('owner')} placeholder="Name" />
              </div>
              <div className="form-group">
                <label>Due Date</label>
                <input type="date" style={inp} value={form.due_date} onChange={setF('due_date')} />
              </div>
              <div className="form-group">
                <label>Framework</label>
                <select style={sel} value={form.framework} onChange={setF('framework')}>
                  <option value="">— None —</option>
                  {FRAMEWORKS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:12 }}>
              <div className="form-group">
                <label>Clause Ref</label>
                <input style={inp} value={form.clause_ref} onChange={setF('clause_ref')} placeholder="e.g. 6.1.2" />
              </div>
              <div className="form-group">
                <label>Program</label>
                <select style={sel} value={form.program_id} onChange={setF('program_id')}>
                  <option value="">— None —</option>
                  {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea style={{ ...inp, height:56, resize:'vertical' }} value={form.description} onChange={setF('description')} />
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button type="button" style={btn()} onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" style={btn('primary')}>Add Task</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <input style={{ ...inp, maxWidth:240 }} placeholder="Search tasks…" value={filter.search} onChange={e => setFilter(p=>({...p,search:e.target.value}))} />
        <select style={sel} value={filter.status} onChange={e => setFilter(p=>({...p,status:e.target.value}))}>
          <option value="">All statuses</option>
          {TASK_STATUSES.map(s => <option key={s} value={s}>{humanize(s)}</option>)}
        </select>
        <select style={sel} value={filter.priority} onChange={e => setFilter(p=>({...p,priority:e.target.value}))}>
          <option value="">All priorities</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{cap(p)}</option>)}
        </select>
        <select style={sel} value={filter.framework} onChange={e => setFilter(p=>({...p,framework:e.target.value}))}>
          <option value="">All frameworks</option>
          {FRAMEWORKS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <span style={{ marginLeft:'auto', fontSize:13, color:'var(--text3)' }}>{filtered.length} tasks</span>
      </div>

      <div style={{ overflowX:'auto' }}>
        <table style={tbl}>
          <thead>
            <tr>{['Priority','Title','Owner','Framework','Clause','Due Date','Status',''].map(h=><th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ ...td, textAlign:'center', color:'var(--text3)', padding:32 }}>No tasks found</td></tr>
            )}
            {filtered.map(t => {
              const over = t.status !== 'completed' && t.status !== 'cancelled' && isOverdue(t.due_date);
              return (
                <React.Fragment key={t.id}>
                  <tr style={{ opacity: t.status==='cancelled' ? 0.5 : 1 }}>
                    <td style={td}><span style={badge(PC[t.priority]||'#6b7280')}>{t.priority}</span></td>
                    <td style={{ ...td, cursor:'pointer' }} onClick={() => setExpandedTask(prev => prev === t.id ? null : t.id)}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <div>
                          <div style={{ fontWeight:500, textDecoration: t.status==='completed'?'line-through':'' }}>{t.title}</div>
                          {t.description && <div style={{ fontSize:11, color:'var(--text3)' }}>{t.description.slice(0,60)}{t.description.length>60?'…':''}</div>}
                        </div>
                        {t.nc_type && t.nc_type !== 'action' && <span style={{ ...badge(NC_TYPE_COLORS[t.nc_type]||'#6b7280'), fontSize:10 }}>{humanize(t.nc_type)}</span>}
                        <span style={{ fontSize:11, color:'var(--text3)', marginLeft:'auto', flexShrink:0 }}>{expandedTask===t.id?'▲':'▼'}</span>
                      </div>
                    </td>
                    <td style={td}>{t.owner||'—'}</td>
                    <td style={td}>
                      {t.framework
                        ? <span style={badge((FRAMEWORKS.find(f=>f.id===t.framework)||{color:'#6b7280'}).color)}>{t.framework}</span>
                        : '—'}
                    </td>
                    <td style={td}><code style={{ fontSize:11, color:'var(--text3)' }}>{t.clause_ref||'—'}</code></td>
                    <td style={td}>
                      <span style={{ color: over?'#ef4444':'var(--text1)', fontSize:13, fontWeight: over?700:400 }}>
                        {fmtDate(t.due_date)}{over?' ⚠':''}
                      </span>
                    </td>
                    <td style={td}>
                      {canEdit ? (
                        <select value={t.status} onChange={e => changeStatus(t, e.target.value)}
                          style={{ ...sel, padding:'3px 8px', fontSize:12, color: TC[t.status] }}>
                          {TASK_STATUSES.map(s => <option key={s} value={s}>{humanize(s)}</option>)}
                        </select>
                      ) : (
                        <span style={badge(TC[t.status]||'#6b7280')}>{humanize(t.status)}</span>
                      )}
                    </td>
                    <td style={td}>
                      {canEdit && <button style={{ ...btn('danger'), padding:'4px 10px', fontSize:12 }} onClick={() => del(t.id)}>Del</button>}
                    </td>
                  </tr>
                  {expandedTask === t.id && (
                    <tr>
                      <td colSpan={8} style={{ padding:'0 12px 12px', background:'var(--surface3)' }}>
                        <NCDetail task={t} canEdit={canEdit} onUpdated={load} />
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

/* ── Reviews Tab ──────────────────────────────────────────────── */

const AGENDA_ITEMS = [
  { key:'prev_actions',    label:'Status of actions from previous reviews' },
  { key:'context_changes', label:'Changes in external/internal context' },
  { key:'risk_status',     label:'AI risk register status and trends' },
  { key:'audit_results',   label:'Results of internal audits' },
  { key:'kpi_performance', label:'AIMS objectives and KPI performance' },
  { key:'incidents_ncs',   label:'Incidents and nonconformities' },
  { key:'improvements',    label:'Opportunities for improvement' },
  { key:'resources',       label:'Resource adequacy' },
];

function ReviewsTab({ user }) {
  const [reviews,  setReviews]  = useState([]);
  const [programs, setPrograms] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState(null);
  const blank = { program_id:'', review_date:'', review_type:'management_review', title:'', chair:'', status:'planned', minutes_text:'', approved_by:'', agenda_checklist:{} };
  const [form, setForm] = useState(blank);
  const [err,  setErr]  = useState('');
  const canEdit = ['admin','analyst'].includes(user?.role);

  const load = async () => {
    try {
      const [r, p] = await Promise.all([api.get('/grc/reviews'), api.get('/grc/programs')]);
      setReviews(r.data); setPrograms(p.data);
    } catch {}
  };
  useEffect(() => { load(); }, []);

  const setF = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault(); setErr('');
    try {
      if (editing) await api.put(`/grc/reviews/${editing}`, form);
      else         await api.post('/grc/reviews', form);
      setShowForm(false); setEditing(null); setForm(blank); load();
    } catch (ex) { setErr(ex.response?.data?.error || 'Error'); }
  };

  const startEdit = r => {
    setEditing(r.id);
    setForm({ ...r, review_date: r.review_date?.slice(0,10)||'', agenda_checklist: r.agenda_checklist || {} });
    setShowForm(true);
  };

  const del = async id => {
    if (!window.confirm('Delete this review?')) return;
    try { await api.delete(`/grc/reviews/${id}`); load(); } catch {}
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 style={{ fontSize:18, fontWeight:700, margin:0 }}>Management Reviews & Audits</h2>
        {canEdit && <button style={btn('primary')} onClick={() => { setEditing(null); setForm(blank); setShowForm(s=>!s); }}>+ Schedule Review</button>}
      </div>

      {showForm && canEdit && (
        <div style={{ ...card, marginBottom:20 }}>
          <h3 style={{ fontSize:15, fontWeight:700, margin:'0 0 14px' }}>{editing ? 'Edit Review' : 'Schedule Review'}</h3>
          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {err && <div style={{ color:'#ef4444', fontSize:13 }}>{err}</div>}
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label>Title *</label>
                <input style={inp} value={form.title} onChange={setF('title')} required placeholder="e.g. Q2 2026 Management Review" />
              </div>
              <div className="form-group">
                <label>Type</label>
                <select style={sel} value={form.review_type} onChange={setF('review_type')}>
                  {REVIEW_TYPES.map(t => <option key={t} value={t}>{humanize(t)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select style={sel} value={form.status} onChange={setF('status')}>
                  {['planned','in_progress','completed','cancelled'].map(s => <option key={s} value={s}>{humanize(s)}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label>Review Date *</label>
                <input type="date" style={inp} value={form.review_date} onChange={setF('review_date')} required />
              </div>
              <div className="form-group">
                <label>Chair</label>
                <input style={inp} value={form.chair} onChange={setF('chair')} placeholder="Meeting chair" />
              </div>
              <div className="form-group">
                <label>Approved By</label>
                <input style={inp} value={form.approved_by} onChange={setF('approved_by')} placeholder="Approver name" />
              </div>
              <div className="form-group">
                <label>Program</label>
                <select style={sel} value={form.program_id} onChange={setF('program_id')}>
                  <option value="">— None —</option>
                  {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label style={{ fontWeight:600 }}>ISO 42001 Clause 9.3 Mandatory Agenda Items</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:6 }}>
                {AGENDA_ITEMS.map(item => (
                  <label key={item.key} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'var(--text)', cursor:'pointer', padding:'6px 8px', borderRadius:4, background:'var(--bg3)', border:'1px solid var(--border)' }}>
                    <input
                      type="checkbox"
                      checked={!!(form.agenda_checklist && form.agenda_checklist[item.key])}
                      onChange={e => setForm(p => ({ ...p, agenda_checklist: { ...p.agenda_checklist, [item.key]: e.target.checked } }))}
                      style={{ accentColor:'var(--accent)', flexShrink:0 }}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Minutes / Notes / Decisions</label>
              <textarea style={{ ...inp, height:110, resize:'vertical' }} value={form.minutes_text} onChange={setF('minutes_text')} placeholder="Record meeting outcomes, decisions, action items…" />
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button type="button" style={btn()} onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</button>
              <button type="submit" style={btn('primary')}>{editing ? 'Update' : 'Schedule'}</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {reviews.length === 0 && (
          <div style={{ ...card, textAlign:'center', color:'var(--text3)', padding:32 }}>No reviews scheduled yet</div>
        )}
        {reviews.map(r => (
          <div key={r.id} style={{ ...card, display:'flex', gap:16, alignItems:'flex-start' }}>
            <div style={{ width:4, background: RC[r.status]||'#6b7280', borderRadius:2, alignSelf:'stretch', flexShrink:0 }} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8, flexWrap:'wrap', gap:8 }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:'var(--text1)' }}>{r.title}</div>
                  <div style={{ fontSize:12, color:'var(--text3)', marginTop:3 }}>
                    {humanize(r.review_type)} · {fmtDate(r.review_date)} · Chair: {r.chair||'—'}
                    {r.approved_by && ` · Approved by: ${r.approved_by}`}
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
                  <span style={badge(RC[r.status]||'#6b7280')}>{humanize(r.status)}</span>
                  {canEdit && (
                    <>
                      <button style={{ ...btn(), padding:'4px 10px', fontSize:12 }} onClick={() => startEdit(r)}>Edit</button>
                      <button style={{ ...btn('danger'), padding:'4px 10px', fontSize:12 }} onClick={() => del(r.id)}>Del</button>
                    </>
                  )}
                </div>
              </div>
              {r.agenda_checklist && (() => {
                const covered = AGENDA_ITEMS.filter(i => r.agenda_checklist[i.key]).length;
                const total   = AGENDA_ITEMS.length;
                return (
                  <div style={{ marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                      <span style={{ fontSize:11, color:'var(--text3)', fontWeight:600 }}>Agenda Coverage</span>
                      <span style={{ fontSize:12, fontWeight:700, color: covered===total?'#10b981':'var(--text2)' }}>{covered}/{total} items</span>
                    </div>
                    <div style={{ height:5, background:'var(--surface3)', borderRadius:3, overflow:'hidden', marginBottom:6 }}>
                      <div style={{ height:'100%', width:`${(covered/total)*100}%`, background: covered===total?'#10b981':'#3b82f6', borderRadius:3, transition:'width 0.3s' }} />
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:2 }}>
                      {AGENDA_ITEMS.map(item => {
                        const covered = r.agenda_checklist?.[item.key];
                        return (
                        <span key={item.key} style={{
                          fontSize:11, padding:'3px 8px', borderRadius:10,
                          display:'inline-flex', alignItems:'center', gap:4,
                          background: covered ? 'rgba(16,185,129,0.12)' : 'rgba(139,148,158,0.08)',
                          color: covered ? '#10b981' : 'var(--text2)',
                          border: `1px solid ${covered ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
                        }}>
                          <span style={{ fontSize:10 }}>{covered ? '✓' : '○'}</span>
                          {item.label}
                        </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              {r.minutes_text && (
                <div style={{ fontSize:13, color:'var(--text)', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:6, padding:'10px 14px', whiteSpace:'pre-wrap', maxHeight:120, overflow:'auto', lineHeight:1.5 }}>
                  {r.minutes_text}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── RACI Matrix ──────────────────────────────────────────────── */

const RACI_CYCLE  = ['', 'R', 'A', 'C', 'I'];
const RACI_COLORS = { R:'#3b82f6', A:'#ef4444', C:'#10b981', I:'#f59e0b' };
const RACI_LABELS = { R:'Responsible', A:'Accountable', C:'Consulted', I:'Informed' };

function RACIMatrix({ matrix: init, canEdit, onBack, onSaved }) {
  const [m,       setM]       = useState(init);
  const [saving,  setSaving]  = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [editRole, setEditRole] = useState(null);
  const [editProc, setEditProc] = useState(null);

  const roles     = m.roles     || [];
  const processes = m.processes || [];
  const cells     = m.cells     || {};

  const upd = patch => setM(prev => ({ ...prev, ...patch }));

  const save = async () => {
    setSaving(true); setSaveMsg('');
    try {
      const r = await api.put(`/grc/raci/${m.id}`, m);
      setSaveMsg('Saved'); onSaved(r.data);
      setTimeout(() => setSaveMsg(''), 2000);
    } catch { setSaveMsg('Save failed'); }
    finally { setSaving(false); }
  };

  const exportCSV = () => {
    const header = ['Process','Category',...roles.map(r => r.name)].join(',');
    const rows   = processes.map(p => [
      `"${p.name}"`, `"${p.category||''}"`,
      ...roles.map(r => cells[`${p.id}_${r.id}`] || ''),
    ].join(','));
    const blob = new Blob([[header,...rows].join('\n')], { type:'text/csv' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `RACI_${m.name.replace(/\s+/g,'_')}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  /* role operations */
  const addRole = () => {
    const id = `r${Date.now()}`;
    upd({ roles: [...roles, { id, name:'New Role' }] });
    setEditRole(id);
  };
  const renameRole = (id, name) => upd({ roles: roles.map(r => r.id===id ? {...r,name} : r) });
  const deleteRole = id => {
    const nc = {...cells};
    processes.forEach(p => delete nc[`${p.id}_${id}`]);
    upd({ roles: roles.filter(r => r.id!==id), cells: nc });
  };

  /* process operations */
  const addProcess = () => {
    const id = `p${Date.now()}`;
    upd({ processes: [...processes, { id, name:'New Process', category:'' }] });
    setEditProc(id);
  };
  const updateProc = (id, patch) => upd({ processes: processes.map(p => p.id===id ? {...p,...patch} : p) });
  const deleteProc = id => {
    const nc = {...cells};
    roles.forEach(r => delete nc[`${id}_${r.id}`]);
    upd({ processes: processes.filter(p => p.id!==id), cells: nc });
  };
  const moveProc = (id, dir) => {
    const idx  = processes.findIndex(p => p.id===id);
    const swap = dir==='up' ? idx-1 : idx+1;
    if (swap < 0 || swap >= processes.length) return;
    const arr = [...processes];
    [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
    upd({ processes: arr });
  };

  /* cell cycling */
  const cycleCell = (procId, roleId) => {
    if (!canEdit) return;
    const key = `${procId}_${roleId}`;
    const cur = cells[key] || '';
    const nxt = RACI_CYCLE[(RACI_CYCLE.indexOf(cur) + 1) % RACI_CYCLE.length];
    upd({ cells: { ...cells, [key]: nxt } });
  };

  const stickyBg = 'var(--surface2)';

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <button style={btn()} onClick={onBack}>← Back</button>
        <div style={{ flex:1, minWidth:200 }}>
          <input
            value={m.name}
            onChange={e => upd({ name: e.target.value })}
            disabled={!canEdit}
            style={{ display:'block', width:'100%', fontSize:17, fontWeight:700, background:'transparent', border:'none', borderBottom:'1px solid var(--border2)', color:'var(--text1)', paddingBottom:3, outline:'none', marginBottom:4 }}
          />
          <input
            value={m.description||''}
            onChange={e => upd({ description: e.target.value })}
            disabled={!canEdit}
            placeholder="Description (optional)"
            style={{ display:'block', width:'100%', fontSize:13, background:'transparent', border:'none', borderBottom:'1px solid var(--border2)', color:'var(--text3)', paddingBottom:2, outline:'none' }}
          />
        </div>
        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
          <button style={btn()} onClick={exportCSV}>⬇ CSV</button>
          {canEdit && <button style={btn('primary')} onClick={save} disabled={saving}>{saving?'Saving…':'Save'}</button>}
        </div>
      </div>

      {saveMsg && <div style={{ marginBottom:12, fontSize:13, fontWeight:600, color: saveMsg==='Saved'?'#10b981':'#ef4444' }}>{saveMsg}</div>}

      {/* Legend */}
      <div style={{ display:'flex', gap:14, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        {Object.entries(RACI_LABELS).map(([k,v]) => (
          <div key={k} style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:26, height:26, borderRadius:6, background:RACI_COLORS[k], display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:'#fff' }}>{k}</div>
            <span style={{ fontSize:12, color:'var(--text2)' }}>{v}</span>
          </div>
        ))}
        {canEdit && <span style={{ fontSize:11, color:'var(--text3)', marginLeft:4 }}>— click a cell to cycle · click a name to rename · × to delete</span>}
      </div>

      {/* Table */}
      <div style={{ overflowX:'auto', borderRadius:8, border:'1px solid var(--border1)' }}>
        <table style={{ ...tbl, tableLayout:'auto', minWidth: 400 + roles.length * 110 }}>
          <thead>
            <tr style={{ background:'var(--surface3)' }}>
              <th style={{ ...th, minWidth:220, position:'sticky', left:0, background:'var(--surface3)', zIndex:2 }}>Process / Activity</th>
              <th style={{ ...th, minWidth:140 }}>Category</th>
              {roles.map(r => (
                <th key={r.id} style={{ ...th, minWidth:110, textAlign:'center' }}>
                  {canEdit && editRole===r.id ? (
                    <input
                      autoFocus
                      value={r.name}
                      onChange={e => renameRole(r.id, e.target.value)}
                      onBlur={() => setEditRole(null)}
                      onKeyDown={e => { if (e.key==='Enter'||e.key==='Escape') setEditRole(null); }}
                      style={{ ...inp, padding:'3px 6px', fontSize:12, textAlign:'center', width:'100%' }}
                    />
                  ) : (
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                      <span
                        style={{ cursor: canEdit?'pointer':'default', fontWeight:700 }}
                        onClick={() => canEdit && setEditRole(r.id)}
                        title={canEdit?'Click to rename':''}
                      >{r.name}</span>
                      {canEdit && (
                        <button onClick={() => deleteRole(r.id)}
                          style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontSize:15, lineHeight:1, padding:'0 2px' }}>×</button>
                      )}
                    </div>
                  )}
                </th>
              ))}
              {canEdit && (
                <th style={{ ...th, minWidth:90, textAlign:'center' }}>
                  <button style={{ ...btn('primary'), padding:'4px 10px', fontSize:11 }} onClick={addRole}>+ Role</button>
                </th>
              )}
              {canEdit && <th style={{ ...th, width:72 }} />}
            </tr>
          </thead>
          <tbody>
            {processes.length === 0 && (
              <tr>
                <td colSpan={3 + roles.length + (canEdit ? 2 : 0)}
                  style={{ ...td, textAlign:'center', color:'var(--text3)', padding:36 }}>
                  No processes yet — click "+ Add Process" below
                </td>
              </tr>
            )}
            {processes.map((p, idx) => (
              <tr key={p.id}>
                {/* Process name — sticky */}
                <td style={{ ...td, fontWeight:600, position:'sticky', left:0, background: stickyBg, zIndex:1, minWidth:220 }}>
                  {canEdit && editProc===p.id ? (
                    <input
                      autoFocus
                      value={p.name}
                      onChange={e => updateProc(p.id, { name: e.target.value })}
                      onBlur={() => setEditProc(null)}
                      onKeyDown={e => { if (e.key==='Enter'||e.key==='Escape') setEditProc(null); }}
                      style={{ ...inp, padding:'3px 6px', fontSize:13, width:'100%' }}
                    />
                  ) : (
                    <span
                      style={{ cursor: canEdit?'pointer':'default' }}
                      onClick={() => canEdit && setEditProc(p.id)}
                      title={canEdit?'Click to rename':''}
                    >{p.name}</span>
                  )}
                </td>
                {/* Category — inline editable */}
                <td style={{ ...td, minWidth:140 }}>
                  <input
                    value={p.category||''}
                    onChange={e => updateProc(p.id, { category: e.target.value })}
                    disabled={!canEdit}
                    placeholder={canEdit ? 'Category…' : '—'}
                    style={{ ...inp, padding:'3px 6px', fontSize:12 }}
                  />
                </td>
                {/* RACI cells */}
                {roles.map(r => {
                  const val = cells[`${p.id}_${r.id}`] || '';
                  return (
                    <td key={r.id} style={{ ...td, textAlign:'center', padding:'7px 6px' }}>
                      <div
                        onClick={() => cycleCell(p.id, r.id)}
                        title={val ? `${val} — ${RACI_LABELS[val]}` : canEdit ? 'Click to assign' : '—'}
                        style={{
                          width:34, height:34, borderRadius:7, margin:'0 auto',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontWeight:800, fontSize:14,
                          cursor: canEdit ? 'pointer' : 'default',
                          background: val ? RACI_COLORS[val] : 'var(--surface3)',
                          color: val ? '#fff' : 'var(--text3)',
                          border: val ? 'none' : '1px dashed var(--border2)',
                          transition:'background 0.12s, transform 0.08s',
                          userSelect:'none',
                        }}
                        onMouseDown={e => { if (canEdit) e.currentTarget.style.transform='scale(0.88)'; }}
                        onMouseUp={e => { e.currentTarget.style.transform=''; }}
                        onMouseLeave={e => { e.currentTarget.style.transform=''; }}
                      >
                        {val || '·'}
                      </div>
                    </td>
                  );
                })}
                {/* Spacer under + Role column */}
                {canEdit && <td style={td} />}
                {/* Row controls */}
                {canEdit && (
                  <td style={{ ...td, padding:'4px 8px' }}>
                    <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                      <button onClick={() => moveProc(p.id,'up')} disabled={idx===0}
                        style={{ background:'none', border:'none', cursor:'pointer', color: idx===0?'var(--text3)':'var(--text2)', fontSize:13, padding:'1px 3px', lineHeight:1 }}>↑</button>
                      <button onClick={() => moveProc(p.id,'down')} disabled={idx===processes.length-1}
                        style={{ background:'none', border:'none', cursor:'pointer', color: idx===processes.length-1?'var(--text3)':'var(--text2)', fontSize:13, padding:'1px 3px', lineHeight:1 }}>↓</button>
                      <button onClick={() => deleteProc(p.id)}
                        style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontSize:15, padding:'1px 3px', lineHeight:1 }}>×</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add process */}
      {canEdit && (
        <button style={{ ...btn(), marginTop:12, padding:'7px 16px' }} onClick={addProcess}>
          + Add Process / Activity
        </button>
      )}
    </div>
  );
}

function RACITab({ user }) {
  const [matrices,    setMatrices]    = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [showCreate,  setShowCreate]  = useState(false);
  const [createName,  setCreateName]  = useState('');
  const [creating,    setCreating]    = useState(false);
  const [err,         setErr]         = useState('');
  const canEdit = ['admin','analyst'].includes(user?.role);

  const load = async () => { try { const r = await api.get('/grc/raci'); setMatrices(r.data); } catch {} };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!createName.trim()) return;
    setCreating(true); setErr('');
    try {
      const r = await api.post('/grc/raci', {
        name: createName.trim(),
        roles:     [{ id:'r1', name:'Role 1' }, { id:'r2', name:'Role 2' }, { id:'r3', name:'Role 3' }],
        processes: [{ id:'p1', name:'Process 1', category:'' }],
        cells:     {},
      });
      setSelected(r.data); setShowCreate(false); setCreateName('');
    } catch (ex) { setErr(ex.response?.data?.error || 'Error'); }
    finally { setCreating(false); }
  };

  const del = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this RACI matrix?')) return;
    try { await api.delete(`/grc/raci/${id}`); load(); } catch {}
  };

  if (selected) {
    return (
      <RACIMatrix
        matrix={selected}
        canEdit={canEdit}
        onBack={() => { setSelected(null); load(); }}
        onSaved={upd => setSelected(upd)}
      />
    );
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 style={{ fontSize:18, fontWeight:700, margin:0 }}>RACI Matrices</h2>
        {canEdit && <button style={btn('primary')} onClick={() => { setShowCreate(true); setCreateName(''); setErr(''); }}>+ New Matrix</button>}
      </div>

      {showCreate && canEdit && (
        <div style={{ ...card, marginBottom:20 }}>
          <h3 style={{ fontSize:15, fontWeight:700, margin:'0 0 14px' }}>New RACI Matrix</h3>
          {err && <div style={{ color:'#ef4444', fontSize:13, marginBottom:8 }}>{err}</div>}
          <div style={{ display:'flex', gap:8 }}>
            <input
              autoFocus style={{ ...inp, flex:1 }}
              value={createName}
              onChange={e => setCreateName(e.target.value)}
              onKeyDown={e => { if (e.key==='Enter') create(); if (e.key==='Escape') setShowCreate(false); }}
              placeholder="e.g. ISO 27001 Responsibility Matrix"
            />
            <button style={btn('primary')} onClick={create} disabled={creating||!createName.trim()}>{creating?'Creating…':'Create'}</button>
            <button style={btn()} onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}

      {matrices.length === 0 && !showCreate ? (
        <div style={{ ...card, textAlign:'center', padding:44 }}>
          <div style={{ fontSize:36, marginBottom:12 }}>📊</div>
          <div style={{ fontSize:15, color:'var(--text2)', marginBottom:6 }}>No RACI matrices yet</div>
          <div style={{ fontSize:13, color:'var(--text3)', marginBottom:18 }}>
            Define roles (columns) and processes (rows), assign R · A · C · I per cell
          </div>
          {canEdit && <button style={btn('primary')} onClick={() => setShowCreate(true)}>+ New Matrix</button>}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {matrices.map(m => {
            const roleCount = m.roles?.length || 0;
            const procCount = m.processes?.length || 0;
            const assigned  = Object.values(m.cells||{}).filter(Boolean).length;
            return (
              <div key={m.id} onClick={() => setSelected(m)}
                style={{ ...card, cursor:'pointer', display:'flex', alignItems:'center', gap:16 }}>
                <div style={{ fontSize:28, flexShrink:0 }}>📊</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:15, color:'var(--text1)' }}>{m.name}</div>
                  {m.description && <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{m.description}</div>}
                  <div style={{ fontSize:12, color:'var(--text3)', marginTop:4 }}>
                    {roleCount} role{roleCount!==1?'s':''} · {procCount} process{procCount!==1?'es':''} · {assigned} cell{assigned!==1?'s':''} assigned · Updated {fmtDate(m.updated_at)}
                  </div>
                </div>
                <div style={{ display:'flex', gap:4, flexWrap:'wrap', maxWidth:220, flexShrink:0 }}>
                  {(m.roles||[]).slice(0,6).map(r => (
                    <span key={r.id} style={{ ...badge('#6b7280'), fontSize:10 }}>{r.name}</span>
                  ))}
                  {(m.roles||[]).length > 6 && <span style={{ fontSize:11, color:'var(--text3)' }}>+{m.roles.length-6}</span>}
                </div>
                {canEdit && (
                  <button style={{ ...btn('danger'), padding:'5px 12px', fontSize:12, flexShrink:0 }}
                    onClick={e => del(m.id, e)}>Delete</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Suppliers Tab ────────────────────────────────────────────── */

const SUPPLIER_RISK_COLORS = { critical:'#ef4444', high:'#f97316', medium:'#f59e0b', low:'#10b981' };

function SuppliersTab({ user }) {
  const [suppliers, setSuppliers] = useState([]);
  const [editing,   setEditing]   = useState(null);
  const blankS = {
    name:'', supplier_type:'vendor', contact_name:'', contact_email:'', website:'', country:'',
    risk_rating:'low', status:'active', contract_start:'', contract_end:'',
    data_processing_agreement:false, security_questionnaire_done:false,
    services_provided:'', notes:'',
  };
  const [form, setForm] = useState(blankS);
  const [err,  setErr]  = useState('');
  const canEdit = ['admin','analyst'].includes(user?.role);

  const load = async () => {
    try { const r = await api.get('/suppliers'); setSuppliers(r.data); } catch {}
  };
  useEffect(() => { load(); }, []);

  const setF  = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const setFB = k => e => setForm(p => ({ ...p, [k]: e.target.checked }));

  const submit = async e => {
    e.preventDefault(); setErr('');
    try {
      if (editing === 'new') await api.post('/suppliers', form);
      else                   await api.put(`/suppliers/${editing}`, form);
      setEditing(null); setForm(blankS); load();
    } catch (ex) { setErr(ex.response?.data?.error || 'Error saving supplier'); }
  };

  const startEdit = s => {
    setEditing(s.id);
    setForm({ ...s, contract_start: s.contract_start?.slice(0,10)||'', contract_end: s.contract_end?.slice(0,10)||'' });
  };

  const del = async id => {
    if (!window.confirm('Delete this supplier?')) return;
    try { await api.delete(`/suppliers/${id}`); load(); } catch {}
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 style={{ fontSize:18, fontWeight:700, margin:0 }}>Supplier Register</h2>
        {canEdit && <button style={btn('primary')} onClick={() => { setForm(blankS); setEditing('new'); }}>+ Add Supplier</button>}
      </div>

      {editing && canEdit && (
        <div style={{ ...card, marginBottom:20 }}>
          <h3 style={{ fontSize:15, fontWeight:700, margin:'0 0 14px' }}>{editing==='new'?'New Supplier':'Edit Supplier'}</h3>
          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {err && <div style={{ color:'#ef4444', fontSize:13 }}>{err}</div>}
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label>Name *</label>
                <input style={inp} value={form.name} onChange={setF('name')} required placeholder="Supplier / vendor name" />
              </div>
              <div className="form-group">
                <label>Type</label>
                <select style={sel} value={form.supplier_type} onChange={setF('supplier_type')}>
                  {[['vendor','Vendor'],['data_provider','Data Provider'],['infrastructure','Infrastructure'],['saas_ai','SaaS / AI'],['consultant','Consultant']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Risk Rating</label>
                <select style={sel} value={form.risk_rating} onChange={setF('risk_rating')}>
                  {['low','medium','high','critical'].map(r=><option key={r} value={r}>{cap(r)}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label>Contact Name</label>
                <input style={inp} value={form.contact_name} onChange={setF('contact_name')} />
              </div>
              <div className="form-group">
                <label>Contact Email</label>
                <input type="email" style={inp} value={form.contact_email} onChange={setF('contact_email')} />
              </div>
              <div className="form-group">
                <label>Website</label>
                <input style={inp} value={form.website} onChange={setF('website')} placeholder="https://…" />
              </div>
              <div className="form-group">
                <label>Country</label>
                <input style={inp} value={form.country} onChange={setF('country')} />
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label>Status</label>
                <select style={sel} value={form.status} onChange={setF('status')}>
                  {[['active','Active'],['inactive','Inactive'],['under_review','Under Review']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Contract Start</label>
                <input type="date" style={inp} value={form.contract_start} onChange={setF('contract_start')} />
              </div>
              <div className="form-group">
                <label>Contract End</label>
                <input type="date" style={inp} value={form.contract_end} onChange={setF('contract_end')} />
              </div>
            </div>
            <div style={{ display:'flex', gap:24 }}>
              <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer' }}>
                <input type="checkbox" checked={form.data_processing_agreement} onChange={setFB('data_processing_agreement')} style={{ accentColor:'var(--accent)' }} />
                Data Processing Agreement signed
              </label>
              <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer' }}>
                <input type="checkbox" checked={form.security_questionnaire_done} onChange={setFB('security_questionnaire_done')} style={{ accentColor:'var(--accent)' }} />
                Security questionnaire completed
              </label>
            </div>
            <div className="form-group">
              <label>Services Provided</label>
              <textarea style={{ ...inp, height:56, resize:'vertical' }} value={form.services_provided} onChange={setF('services_provided')} />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea style={{ ...inp, height:48, resize:'vertical' }} value={form.notes} onChange={setF('notes')} />
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button type="button" style={btn()} onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" style={btn('primary')}>{editing==='new'?'Add Supplier':'Update'}</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ overflowX:'auto' }}>
        <table style={tbl}>
          <thead>
            <tr>{['Name','Type','Risk Rating','Status','DPA','Sec. Questionnaire','Contract End','Actions'].map(h=><th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {suppliers.length === 0 && (
              <tr><td colSpan={8} style={{ ...td, textAlign:'center', color:'var(--text3)', padding:32 }}>No suppliers registered yet</td></tr>
            )}
            {suppliers.map(s => (
              <tr key={s.id}>
                <td style={td}>
                  <div style={{ fontWeight:600 }}>{s.name}</div>
                  {s.country && <div style={{ fontSize:11, color:'var(--text3)' }}>{s.country}</div>}
                </td>
                <td style={td}><span style={badge('#6b7280')}>{humanize(s.supplier_type)}</span></td>
                <td style={td}><span style={badge(SUPPLIER_RISK_COLORS[s.risk_rating]||'#6b7280')}>{cap(s.risk_rating)}</span></td>
                <td style={td}><span style={badge(s.status==='active'?'#10b981':s.status==='under_review'?'#f59e0b':'#9ca3af')}>{humanize(s.status)}</span></td>
                <td style={{ ...td, textAlign:'center' }}>{s.data_processing_agreement ? <span style={{ color:'#10b981', fontWeight:700 }}>✓</span> : <span style={{ color:'#9ca3af' }}>—</span>}</td>
                <td style={{ ...td, textAlign:'center' }}>{s.security_questionnaire_done ? <span style={{ color:'#10b981', fontWeight:700 }}>✓</span> : <span style={{ color:'#9ca3af' }}>—</span>}</td>
                <td style={td}>
                  {s.contract_end
                    ? <span style={{ color: isOverdue(s.contract_end)?'#ef4444':'var(--text1)', fontSize:13 }}>{fmtDate(s.contract_end)}</span>
                    : '—'}
                </td>
                <td style={td}>
                  {canEdit && (
                    <div style={{ display:'flex', gap:6 }}>
                      <button style={{ ...btn(), padding:'4px 10px', fontSize:12 }} onClick={() => startEdit(s)}>Edit</button>
                      <button style={{ ...btn('danger'), padding:'4px 10px', fontSize:12 }} onClick={() => del(s.id)}>Del</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── AI Systems Tab ───────────────────────────────────────────── */

const AI_ACT_COLORS = { unacceptable:'#ef4444', high:'#f97316', limited:'#f59e0b', minimal:'#10b981' };

function AISystemsTab({ user }) {
  const [systems,  setSystems]  = useState([]);
  const [editing,  setEditing]  = useState(null);
  const blankA = {
    name:'', version:'', ai_type:'generative_ai', vendor:'', business_purpose:'',
    decision_role:'advisory', uses_personal_data:false, eu_ai_act_tier:'minimal',
    deployment_status:'planned', owner:'', deployed_date:'', next_review_date:'', notes:'',
  };
  const [form, setForm] = useState(blankA);
  const [err,  setErr]  = useState('');
  const canEdit = ['admin','analyst'].includes(user?.role);

  const load = async () => {
    try { const r = await api.get('/ai-systems'); setSystems(r.data); } catch {}
  };
  useEffect(() => { load(); }, []);

  const setF  = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const setFB = k => e => setForm(p => ({ ...p, [k]: e.target.checked }));

  const submit = async e => {
    e.preventDefault(); setErr('');
    try {
      if (editing === 'new') await api.post('/ai-systems', form);
      else                   await api.put(`/ai-systems/${editing}`, form);
      setEditing(null); setForm(blankA); load();
    } catch (ex) { setErr(ex.response?.data?.error || 'Error saving AI system'); }
  };

  const startEdit = s => {
    setEditing(s.id);
    setForm({ ...s, deployed_date: s.deployed_date?.slice(0,10)||'', next_review_date: s.next_review_date?.slice(0,10)||'' });
  };

  const del = async id => {
    if (!window.confirm('Delete this AI system record?')) return;
    try { await api.delete(`/ai-systems/${id}`); load(); } catch {}
  };

  const markAssessed = async id => {
    try { await api.post(`/ai-systems/${id}/mark-assessed`); load(); } catch (ex) { alert(ex.response?.data?.error || 'Failed'); }
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 style={{ fontSize:18, fontWeight:700, margin:0 }}>AI Systems Register</h2>
        {canEdit && <button style={btn('primary')} onClick={() => { setForm(blankA); setEditing('new'); }}>+ Add AI System</button>}
      </div>

      {editing && canEdit && (
        <div style={{ ...card, marginBottom:20 }}>
          <h3 style={{ fontSize:15, fontWeight:700, margin:'0 0 14px' }}>{editing==='new'?'New AI System':'Edit AI System'}</h3>
          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {err && <div style={{ color:'#ef4444', fontSize:13 }}>{err}</div>}
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label>Name *</label>
                <input style={inp} value={form.name} onChange={setF('name')} required placeholder="AI system name" />
              </div>
              <div className="form-group">
                <label>Version</label>
                <input style={inp} value={form.version} onChange={setF('version')} placeholder="e.g. 1.0" />
              </div>
              <div className="form-group">
                <label>AI Type</label>
                <select style={sel} value={form.ai_type} onChange={setF('ai_type')}>
                  {[['generative_ai','Generative AI'],['ml_predictive','ML Predictive'],['nlp','NLP'],['computer_vision','Computer Vision'],['rpa_ai','RPA / AI'],['analytics','Analytics'],['other','Other']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label>Vendor</label>
                <input style={inp} value={form.vendor} onChange={setF('vendor')} />
              </div>
              <div className="form-group">
                <label>Decision Role</label>
                <select style={sel} value={form.decision_role} onChange={setF('decision_role')}>
                  {[['advisory','Advisory'],['automated','Automated'],['augmented','Augmented']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>EU AI Act Tier</label>
                <select style={sel} value={form.eu_ai_act_tier} onChange={setF('eu_ai_act_tier')}>
                  {[['unacceptable','Unacceptable'],['high','High'],['limited','Limited'],['minimal','Minimal']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Deployment Status</label>
                <select style={sel} value={form.deployment_status} onChange={setF('deployment_status')}>
                  {[['planned','Planned'],['in_use','In Use'],['retired','Retired'],['suspended','Suspended']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label>Owner</label>
                <input style={inp} value={form.owner} onChange={setF('owner')} />
              </div>
              <div className="form-group">
                <label>Deployed Date</label>
                <input type="date" style={inp} value={form.deployed_date} onChange={setF('deployed_date')} />
              </div>
              <div className="form-group">
                <label>Next Review Date</label>
                <input type="date" style={inp} value={form.next_review_date} onChange={setF('next_review_date')} />
              </div>
            </div>
            <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer' }}>
              <input type="checkbox" checked={form.uses_personal_data} onChange={setFB('uses_personal_data')} style={{ accentColor:'var(--accent)' }} />
              Uses personal data
            </label>
            <div className="form-group">
              <label>Business Purpose</label>
              <textarea style={{ ...inp, height:60, resize:'vertical' }} value={form.business_purpose} onChange={setF('business_purpose')} placeholder="Describe the business purpose and use case…" />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea style={{ ...inp, height:48, resize:'vertical' }} value={form.notes} onChange={setF('notes')} />
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button type="button" style={btn()} onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" style={btn('primary')}>{editing==='new'?'Add AI System':'Update'}</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ overflowX:'auto' }}>
        <table style={tbl}>
          <thead>
            <tr>{['Name','Type','AI Act Tier','Decision Role','Personal Data','Status','Owner','Impact Assessed','Actions'].map(h=><th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {systems.length === 0 && (
              <tr><td colSpan={9} style={{ ...td, textAlign:'center', color:'var(--text3)', padding:32 }}>No AI systems registered yet</td></tr>
            )}
            {systems.map(s => (
              <tr key={s.id}>
                <td style={td}>
                  <div style={{ fontWeight:600 }}>{s.name}</div>
                  {s.version && <div style={{ fontSize:11, color:'var(--text3)' }}>v{s.version}</div>}
                  {s.vendor  && <div style={{ fontSize:11, color:'var(--text3)' }}>{s.vendor}</div>}
                </td>
                <td style={td}><span style={badge('#6b7280')}>{humanize(s.ai_type)}</span></td>
                <td style={td}><span style={badge(AI_ACT_COLORS[s.eu_ai_act_tier]||'#6b7280')}>{cap(s.eu_ai_act_tier)}</span></td>
                <td style={td}><span style={badge('#6b7280')}>{humanize(s.decision_role)}</span></td>
                <td style={{ ...td, textAlign:'center' }}>{s.uses_personal_data ? <span style={{ color:'#f97316', fontWeight:700 }}>Yes</span> : <span style={{ color:'#6b7280' }}>No</span>}</td>
                <td style={td}><span style={badge(s.deployment_status==='in_use'?'#10b981':s.deployment_status==='planned'?'#3b82f6':s.deployment_status==='suspended'?'#f59e0b':'#9ca3af')}>{humanize(s.deployment_status)}</span></td>
                <td style={td}>{s.owner||'—'}</td>
                <td style={td}>
                  {s.impact_assessed
                    ? <div style={{ color:'#10b981', fontSize:12, fontWeight:600 }}>✓ {fmtDate(s.impact_assessed_at)}</div>
                    : canEdit
                      ? <button style={{ ...btn(), padding:'3px 10px', fontSize:11 }} onClick={() => markAssessed(s.id)}>Mark Assessed</button>
                      : <span style={{ color:'var(--text3)', fontSize:12 }}>—</span>
                  }
                </td>
                <td style={td}>
                  {canEdit && (
                    <div style={{ display:'flex', gap:6 }}>
                      <button style={{ ...btn(), padding:'4px 10px', fontSize:12 }} onClick={() => startEdit(s)}>Edit</button>
                      <button style={{ ...btn('danger'), padding:'4px 10px', fontSize:12 }} onClick={() => del(s.id)}>Del</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Steering Committee Tab ───────────────────────────────────── */

const ISSC_ROLES = ['Chair','Vice Chair','Secretary','Member','Advisor','Observer'];
const MTG_TYPES  = ['regular','extraordinary','annual','emergency'];
const MTG_STATUS = ['scheduled','completed','cancelled'];
const ROLE_COLORS = { Chair:'#3b82f6', 'Vice Chair':'#8b5cf6', Secretary:'#10b981', Member:'#6b7280', Advisor:'#f59e0b', Observer:'#9ca3af' };

function SteeringTab({ user }) {
  const canEdit = ['admin'].includes(user?.role);
  const [members,  setMembers]  = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [section,  setSection]  = useState('members'); // 'members' | 'meetings'
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState(null);

  const blankMember  = { full_name:'', title:'', department:'', email:'', role:'Member', joined_date:'', notes:'' };
  const blankMeeting = { title:'', meeting_date:'', meeting_type:'regular', status:'scheduled', location:'', chair:'', quorum_met:false, attendees:'', agenda:'', minutes:'', decisions:'', action_items:'', next_meeting_date:'' };
  const [form, setForm] = useState(blankMember);
  const [err,  setErr]  = useState('');

  const load = async () => {
    try {
      const [m, mt] = await Promise.all([api.get('/issc/members'), api.get('/issc/meetings')]);
      setMembers(m.data); setMeetings(mt.data);
    } catch {}
  };
  useEffect(() => { load(); }, []);

  const switchSection = s => { setSection(s); setShowForm(false); setEditing(null); setErr(''); setForm(s === 'members' ? blankMember : blankMeeting); };

  const submit = async e => {
    e.preventDefault(); setErr('');
    try {
      const endpoint = section === 'members' ? '/issc/members' : '/issc/meetings';
      if (editing) await api.put(`${endpoint}/${editing}`, form);
      else         await api.post(endpoint, form);
      setShowForm(false); setEditing(null); setForm(section === 'members' ? blankMember : blankMeeting); load();
    } catch (ex) { setErr(ex.response?.data?.error || 'Save failed'); }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this record?')) return;
    const endpoint = section === 'members' ? '/issc/members' : '/issc/meetings';
    try { await api.delete(`${endpoint}/${id}`); load(); } catch {}
  };

  const startEdit = (row) => {
    setEditing(row.id);
    const f = section === 'members'
      ? { full_name: row.full_name, title: row.title||'', department: row.department||'', email: row.email||'', role: row.role||'Member', joined_date: row.joined_date?.slice(0,10)||'', notes: row.notes||'' }
      : { title: row.title, meeting_date: row.meeting_date?.slice(0,10)||'', meeting_type: row.meeting_type||'regular', status: row.status||'scheduled', location: row.location||'', chair: row.chair||'', quorum_met: row.quorum_met||false, attendees: row.attendees||'', agenda: row.agenda||'', minutes: row.minutes||'', decisions: row.decisions||'', action_items: row.action_items||'', next_meeting_date: row.next_meeting_date?.slice(0,10)||'' };
    setForm(f); setShowForm(true);
  };

  const setF = k => e => setForm(p => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:700, margin:0, color:'var(--text)' }}>Information Security Steering Committee</h2>
          <div style={{ fontSize:12, color:'var(--text2)', marginTop:3 }}>Governance body overseeing information security strategy and risk oversight</div>
        </div>
        {canEdit && (
          <button style={btn('primary')} onClick={() => { setForm(section === 'members' ? blankMember : blankMeeting); setEditing(null); setShowForm(s => !s); }}>
            + {section === 'members' ? 'Add Member' : 'Schedule Meeting'}
          </button>
        )}
      </div>

      {/* Section switcher */}
      <div style={{ display:'flex', gap:4, marginBottom:16, borderBottom:'1px solid var(--border)', paddingBottom:0 }}>
        {[{id:'members',label:`Members (${members.filter(m=>m.is_active).length})`},{id:'meetings',label:`Meetings (${meetings.length})`}].map(s => (
          <button key={s.id} onClick={() => switchSection(s.id)}
            style={{ padding:'7px 16px', fontSize:13, fontWeight: section===s.id ? 600 : 400, background:'none', border:'none', cursor:'pointer',
              color: section===s.id ? 'var(--accent-h)' : 'var(--text2)',
              borderBottom: section===s.id ? '2px solid var(--accent-h)' : '2px solid transparent', marginBottom:-1 }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Form panel */}
      {showForm && canEdit && (
        <div style={{ ...card, marginBottom:20 }}>
          <h3 style={{ fontSize:14, fontWeight:700, margin:'0 0 14px', color:'var(--text)' }}>{editing ? 'Edit' : 'Add'} {section === 'members' ? 'Member' : 'Meeting'}</h3>
          <form onSubmit={submit}>
            {err && <div style={{ color:'#ef4444', fontSize:13, marginBottom:10 }}>{err}</div>}
            {section === 'members' ? (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:12 }}>
                  <div className="form-group"><label>Full Name *</label><input style={inp} value={form.full_name} onChange={setF('full_name')} required /></div>
                  <div className="form-group"><label>Title / Position</label><input style={inp} value={form.title} onChange={setF('title')} placeholder="CISO, IT Director…" /></div>
                  <div className="form-group"><label>Department</label><input style={inp} value={form.department} onChange={setF('department')} /></div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:12 }}>
                  <div className="form-group"><label>Email</label><input style={inp} type="email" value={form.email} onChange={setF('email')} /></div>
                  <div className="form-group"><label>Committee Role</label>
                    <select style={sel} value={form.role} onChange={setF('role')}>
                      {ISSC_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Joined Date</label><input type="date" style={inp} value={form.joined_date} onChange={setF('joined_date')} /></div>
                </div>
                <div className="form-group"><label>Notes</label><textarea style={{ ...inp, height:70, resize:'vertical' }} value={form.notes} onChange={setF('notes')} /></div>
              </>
            ) : (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:12, marginBottom:12 }}>
                  <div className="form-group"><label>Meeting Title *</label><input style={inp} value={form.title} onChange={setF('title')} required /></div>
                  <div className="form-group"><label>Date *</label><input type="date" style={inp} value={form.meeting_date} onChange={setF('meeting_date')} required /></div>
                  <div className="form-group"><label>Type</label>
                    <select style={sel} value={form.meeting_type} onChange={setF('meeting_type')}>
                      {MTG_TYPES.map(t => <option key={t} value={t}>{cap(t)}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Status</label>
                    <select style={sel} value={form.status} onChange={setF('status')}>
                      {MTG_STATUS.map(s => <option key={s} value={s}>{cap(s)}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:12 }}>
                  <div className="form-group"><label>Chair</label><input style={inp} value={form.chair} onChange={setF('chair')} /></div>
                  <div className="form-group"><label>Location / Link</label><input style={inp} value={form.location} onChange={setF('location')} /></div>
                  <div className="form-group"><label>Next Meeting Date</label><input type="date" style={inp} value={form.next_meeting_date} onChange={setF('next_meeting_date')} /></div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                  <div className="form-group"><label>Attendees</label><textarea style={{ ...inp, height:70, resize:'vertical' }} value={form.attendees} onChange={setF('attendees')} placeholder="List of attendees" /></div>
                  <div className="form-group"><label>Agenda</label><textarea style={{ ...inp, height:70, resize:'vertical' }} value={form.agenda} onChange={setF('agenda')} placeholder="Agenda items…" /></div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                  <div className="form-group"><label>Minutes / Notes</label><textarea style={{ ...inp, height:90, resize:'vertical' }} value={form.minutes} onChange={setF('minutes')} /></div>
                  <div className="form-group"><label>Decisions Made</label><textarea style={{ ...inp, height:90, resize:'vertical' }} value={form.decisions} onChange={setF('decisions')} /></div>
                </div>
                <div className="form-group"><label>Action Items</label><textarea style={{ ...inp, height:70, resize:'vertical' }} value={form.action_items} onChange={setF('action_items')} /></div>
                <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'var(--text)', marginBottom:12 }}>
                  <input type="checkbox" checked={form.quorum_met} onChange={setF('quorum_met')} style={{ accentColor:'var(--accent)' }} /> Quorum met
                </label>
              </>
            )}
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button type="button" style={btn()} onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</button>
              <button type="submit" style={btn('primary')}>{editing ? 'Update' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Members table */}
      {section === 'members' && (
        <div style={{ overflowX:'auto' }}>
          {members.length === 0
            ? <div style={{ ...card, textAlign:'center', color:'var(--text2)', padding:32 }}>No members added yet</div>
            : <table style={tbl}>
                <thead><tr>{['Name','Title','Department','Email','Role','Joined',''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {members.map(m => (
                    <tr key={m.id} style={{ opacity: m.is_active ? 1 : 0.45 }}>
                      <td style={td}><div style={{ fontWeight:600, color:'var(--text)' }}>{m.full_name}</div>{!m.is_active && <span style={{ fontSize:10, color:'#ef4444' }}>Inactive</span>}</td>
                      <td style={td}>{m.title||'—'}</td>
                      <td style={td}>{m.department||'—'}</td>
                      <td style={td}>{m.email ? <a href={`mailto:${m.email}`} style={{ color:'var(--accent-h)', textDecoration:'none' }}>{m.email}</a> : '—'}</td>
                      <td style={td}><span style={{ ...badge(ROLE_COLORS[m.role]||'#6b7280') }}>{m.role}</span></td>
                      <td style={td}>{m.joined_date ? fmtDate(m.joined_date) : '—'}</td>
                      <td style={td}>
                        {canEdit && <div style={{ display:'flex', gap:6 }}>
                          <button style={{ ...btn(), padding:'4px 10px', fontSize:12 }} onClick={() => startEdit(m)}>Edit</button>
                          <button style={{ ...btn('danger'), padding:'4px 10px', fontSize:12 }} onClick={() => del(m.id)}>Delete</button>
                        </div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>
      )}

      {/* Meetings list */}
      {section === 'meetings' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {meetings.length === 0 && <div style={{ ...card, textAlign:'center', color:'var(--text2)', padding:32 }}>No meetings scheduled yet</div>}
          {meetings.map(m => {
            const sc = { scheduled:'#6b7280', completed:'#10b981', cancelled:'#ef4444' };
            return (
              <div key={m.id} style={{ ...card, borderLeft:`4px solid ${sc[m.status]||'#6b7280'}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8, marginBottom:10 }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:15, color:'var(--text)' }}>{m.title}</div>
                    <div style={{ fontSize:12, color:'var(--text2)', marginTop:3 }}>
                      {fmtDate(m.meeting_date)} · {cap(m.meeting_type)} · Chair: {m.chair||'—'}
                      {m.location && ` · ${m.location}`}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <span style={badge(sc[m.status]||'#6b7280')}>{cap(m.status)}</span>
                    {m.quorum_met !== null && <span style={{ fontSize:11, color: m.quorum_met ? '#10b981' : '#ef4444' }}>{m.quorum_met ? '✓ Quorum' : '✗ No quorum'}</span>}
                    {canEdit && <>
                      <button style={{ ...btn(), padding:'4px 10px', fontSize:12 }} onClick={() => startEdit(m)}>Edit</button>
                      <button style={{ ...btn('danger'), padding:'4px 10px', fontSize:12 }} onClick={() => del(m.id)}>Delete</button>
                    </>}
                  </div>
                </div>
                {m.agenda && <div style={{ marginBottom:8 }}><div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:3 }}>AGENDA</div><div style={{ fontSize:13, color:'var(--text)', whiteSpace:'pre-wrap', lineHeight:1.5 }}>{m.agenda}</div></div>}
                {m.decisions && <div style={{ marginBottom:8 }}><div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:3 }}>DECISIONS</div><div style={{ fontSize:13, color:'var(--text)', whiteSpace:'pre-wrap', lineHeight:1.5 }}>{m.decisions}</div></div>}
                {m.action_items && <div style={{ marginBottom:8 }}><div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:3 }}>ACTION ITEMS</div><div style={{ fontSize:13, color:'var(--text)', whiteSpace:'pre-wrap', lineHeight:1.5 }}>{m.action_items}</div></div>}
                {m.next_meeting_date && <div style={{ fontSize:12, color:'var(--text2)', marginTop:6 }}>Next meeting: <strong>{fmtDate(m.next_meeting_date)}</strong></div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Risk Appetite & Tolerance Tab ────────────────────────────── */

const CATEGORIES = ['Operational','Compliance','Reputational','Financial','Technology','Third-party'];
const CAT_LEVELS = ['very_low','low','medium','high','very_high'];
const CAT_COLORS = { very_low:'#10b981', low:'#3b82f6', medium:'#f59e0b', high:'#f97316', very_high:'#ef4444' };
const CAT_LABELS = { very_low:'Very Low', low:'Low', medium:'Medium', high:'High', very_high:'Very High' };

function AppetiteTab({ user }) {
  const canEdit = user?.role === 'admin';
  const [data,    setData]    = useState(null);
  const [editing, setEditing] = useState(false);
  const [form,    setForm]    = useState({});
  const [err,     setErr]     = useState('');
  const [saved,   setSaved]   = useState(false);

  const load = async () => {
    try { const r = await api.get('/issc/appetite'); setData(r.data); } catch {}
  };
  useEffect(() => { load(); }, []);

  const startEdit = () => {
    setForm({
      max_risk_score:      data?.max_risk_score     ?? 12,
      tolerance_score:     data?.tolerance_score    ?? 15,
      max_ale:             data?.max_ale            ?? 100000,
      tolerance_ale:       data?.tolerance_ale      ?? 250000,
      max_open_critical:   data?.max_open_critical  ?? 0,
      appetite_statement:  data?.appetite_statement ?? '',
      tolerance_statement: data?.tolerance_statement?? '',
      approved_by:         data?.approved_by        ?? '',
      approval_date:       data?.approval_date?.slice(0,10) ?? '',
      review_frequency:    data?.review_frequency   ?? 'annually',
      category_appetites:  data?.category_appetites ?? {},
      notes:               data?.notes              ?? '',
    });
    setEditing(true); setSaved(false); setErr('');
  };

  const save = async e => {
    e.preventDefault(); setErr('');
    try {
      const r = await api.put('/issc/appetite', { ...form, max_risk_score: Number(form.max_risk_score), tolerance_score: Number(form.tolerance_score), max_ale: Number(form.max_ale), tolerance_ale: Number(form.tolerance_ale), max_open_critical: Number(form.max_open_critical) });
      setData(r.data); setEditing(false); setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (ex) { setErr(ex.response?.data?.error || 'Save failed'); }
  };

  const setF = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const setCat = (cat, val) => setForm(p => ({ ...p, category_appetites: { ...(p.category_appetites||{}), [cat]: val } }));

  const appetiteScore    = data?.max_risk_score   ?? 12;
  const toleranceScore   = data?.tolerance_score  ?? 15;

  const getScoreLabel = score => {
    if (score <= appetiteScore)  return { label:'Within Appetite',  color:'#10b981' };
    if (score <= toleranceScore) return { label:'Within Tolerance', color:'#f59e0b' };
    return                               { label:'Exceeds Tolerance',color:'#ef4444' };
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:700, margin:0, color:'var(--text)' }}>Risk Appetite & Tolerance</h2>
          <div style={{ fontSize:12, color:'var(--text2)', marginTop:3 }}>
            Defines acceptable risk thresholds — reviewed {data?.review_frequency || 'annually'}
            {data?.approved_by && ` · Approved by: ${data.approved_by}`}
            {data?.approval_date && ` · ${fmtDate(data.approval_date)}`}
          </div>
        </div>
        {canEdit && !editing && <button style={btn('primary')} onClick={startEdit}>Edit</button>}
        {saved && <span style={{ fontSize:13, color:'#10b981' }}>✓ Saved</span>}
      </div>

      {!editing && data && (
        <>
          {/* Score scale */}
          <div style={{ ...card, marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:14 }}>Risk Score Thresholds</div>
            <div style={{ position:'relative', height:40, marginBottom:20 }}>
              <div style={{ position:'absolute', top:14, left:0, right:0, height:12, borderRadius:6, background:`linear-gradient(to right, #10b981 0%, #10b981 ${(appetiteScore/25)*100}%, #f59e0b ${(appetiteScore/25)*100}%, #f59e0b ${(toleranceScore/25)*100}%, #ef4444 ${(toleranceScore/25)*100}%, #ef4444 100%)` }} />
              {[{ val: appetiteScore, label: 'Appetite', color:'#10b981' }, { val: toleranceScore, label: 'Tolerance', color:'#f59e0b' }].map(m => (
                <div key={m.label} style={{ position:'absolute', top:0, left:`${(m.val/25)*100}%`, transform:'translateX(-50%)', textAlign:'center' }}>
                  <div style={{ width:2, height:10, background:m.color, margin:'0 auto 2px' }} />
                  <div style={{ fontSize:10, fontWeight:700, color:m.color, whiteSpace:'nowrap' }}>{m.label}: {m.val}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
              {[
                { label:'Risk Appetite Score',    val: appetiteScore,    color:'#10b981', desc:`≤ ${appetiteScore} = acceptable` },
                { label:'Risk Tolerance Score',   val: toleranceScore,   color:'#f59e0b', desc:`${appetiteScore+1}–${toleranceScore} = tolerated` },
                { label:'Max Open Critical Risks',val: data.max_open_critical??0, color:'#ef4444', desc:'Target: zero critical risks' },
              ].map(item => (
                <div key={item.label} style={{ background:'var(--bg3)', borderRadius:8, padding:'12px 14px', borderLeft:`3px solid ${item.color}` }}>
                  <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4 }}>{item.label}</div>
                  <div style={{ fontSize:24, fontWeight:700, color:item.color }}>{item.val}</div>
                  <div style={{ fontSize:11, color:'var(--text2)' }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ALE thresholds */}
          <div style={{ ...card, marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:12 }}>Financial Exposure Thresholds (ALE)</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div style={{ background:'var(--bg3)', borderRadius:8, padding:'12px 14px', borderLeft:'3px solid #10b981' }}>
                <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4 }}>ALE Appetite</div>
                <div style={{ fontSize:22, fontWeight:700, color:'#10b981' }}>${Number(data.max_ale||0).toLocaleString()}</div>
                <div style={{ fontSize:11, color:'var(--text2)' }}>Maximum acceptable annual loss</div>
              </div>
              <div style={{ background:'var(--bg3)', borderRadius:8, padding:'12px 14px', borderLeft:'3px solid #f59e0b' }}>
                <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4 }}>ALE Tolerance</div>
                <div style={{ fontSize:22, fontWeight:700, color:'#f59e0b' }}>${Number(data.tolerance_ale||0).toLocaleString()}</div>
                <div style={{ fontSize:11, color:'var(--text2)' }}>Maximum tolerated annual loss</div>
              </div>
            </div>
          </div>

          {/* Statements */}
          {(data.appetite_statement || data.tolerance_statement) && (
            <div style={{ ...card, marginBottom:16 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:12 }}>Formal Statements</div>
              {data.appetite_statement && (
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:11, color:'#10b981', fontWeight:700, marginBottom:4 }}>RISK APPETITE STATEMENT</div>
                  <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.6, background:'var(--bg3)', padding:'10px 14px', borderRadius:6, borderLeft:'3px solid #10b981' }}>{data.appetite_statement}</div>
                </div>
              )}
              {data.tolerance_statement && (
                <div>
                  <div style={{ fontSize:11, color:'#f59e0b', fontWeight:700, marginBottom:4 }}>RISK TOLERANCE STATEMENT</div>
                  <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.6, background:'var(--bg3)', padding:'10px 14px', borderRadius:6, borderLeft:'3px solid #f59e0b' }}>{data.tolerance_statement}</div>
                </div>
              )}
            </div>
          )}

          {/* Category appetites */}
          {Object.keys(data.category_appetites||{}).length > 0 && (
            <div style={{ ...card, marginBottom:16 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:12 }}>Risk Appetite by Category</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
                {CATEGORIES.filter(c => data.category_appetites[c]).map(c => {
                  const lv = data.category_appetites[c];
                  return <span key={c} style={{ ...badge(CAT_COLORS[lv]||'#6b7280'), fontSize:12, padding:'5px 12px' }}>{c}: {CAT_LABELS[lv]||lv}</span>;
                })}
              </div>
            </div>
          )}

          {/* Score legend */}
          <div style={{ ...card }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:12 }}>How Risks Are Classified</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                { color:'#10b981', range:`0 – ${appetiteScore}`, label:'Within Appetite', desc:'Acceptable — no escalation required.' },
                { color:'#f59e0b', range:`${appetiteScore+1} – ${toleranceScore}`, label:'Within Tolerance', desc:'Elevated — requires active treatment plan and regular review.' },
                { color:'#ef4444', range:`${toleranceScore+1}+`, label:'Exceeds Tolerance', desc:'Unacceptable — immediate escalation to ISSC and board required.' },
              ].map(row => (
                <div key={row.label} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 12px', borderRadius:6, background:'var(--bg3)' }}>
                  <div style={{ width:14, height:14, borderRadius:'50%', background:row.color, flexShrink:0 }} />
                  <div style={{ minWidth:140, fontWeight:600, color:row.color, fontSize:13 }}>{row.label}</div>
                  <div style={{ fontSize:12, color:'var(--text2)', minWidth:80 }}>Score: {row.range}</div>
                  <div style={{ fontSize:12, color:'var(--text2)' }}>{row.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Edit form */}
      {editing && (
        <form onSubmit={save} style={{ ...card }}>
          {err && <div style={{ color:'#ef4444', fontSize:13, marginBottom:12 }}>{err}</div>}
          <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:16 }}>Risk Score Thresholds</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
            <div className="form-group"><label>Risk Appetite Score</label><input type="number" style={inp} value={form.max_risk_score} onChange={setF('max_risk_score')} min={1} max={25} /></div>
            <div className="form-group"><label>Risk Tolerance Score</label><input type="number" style={inp} value={form.tolerance_score} onChange={setF('tolerance_score')} min={1} max={25} /></div>
            <div className="form-group"><label>Max Open Critical Risks</label><input type="number" style={inp} value={form.max_open_critical} onChange={setF('max_open_critical')} min={0} /></div>
          </div>

          <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:16 }}>Financial Thresholds (ALE)</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
            <div className="form-group"><label>ALE Appetite ($)</label><input type="number" style={inp} value={form.max_ale} onChange={setF('max_ale')} min={0} /></div>
            <div className="form-group"><label>ALE Tolerance ($)</label><input type="number" style={inp} value={form.tolerance_ale} onChange={setF('tolerance_ale')} min={0} /></div>
          </div>

          <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:16 }}>Formal Statements</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
            <div className="form-group"><label>Risk Appetite Statement</label><textarea style={{ ...inp, height:90, resize:'vertical' }} value={form.appetite_statement} onChange={setF('appetite_statement')} placeholder="The organisation accepts low operational risk…" /></div>
            <div className="form-group"><label>Risk Tolerance Statement</label><textarea style={{ ...inp, height:90, resize:'vertical' }} value={form.tolerance_statement} onChange={setF('tolerance_statement')} placeholder="Temporary deviations above appetite are tolerable when…" /></div>
          </div>

          <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:16 }}>Approval & Governance</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:20 }}>
            <div className="form-group"><label>Approved By</label><input style={inp} value={form.approved_by} onChange={setF('approved_by')} placeholder="Name / role" /></div>
            <div className="form-group"><label>Approval Date</label><input type="date" style={inp} value={form.approval_date} onChange={setF('approval_date')} /></div>
            <div className="form-group"><label>Review Frequency</label>
              <select style={sel} value={form.review_frequency} onChange={setF('review_frequency')}>
                {['monthly','quarterly','semi_annually','annually'].map(f => <option key={f} value={f}>{cap(humanize(f))}</option>)}
              </select>
            </div>
          </div>

          <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:12 }}>Risk Appetite by Category</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:20 }}>
            {CATEGORIES.map(c => (
              <div className="form-group" key={c}>
                <label>{c}</label>
                <select style={sel} value={(form.category_appetites||{})[c]||''} onChange={e => setCat(c, e.target.value)}>
                  <option value="">— Not set —</option>
                  {CAT_LEVELS.map(l => <option key={l} value={l}>{CAT_LABELS[l]}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div className="form-group" style={{ marginBottom:20 }}>
            <label>Additional Notes</label>
            <textarea style={{ ...inp, height:70, resize:'vertical' }} value={form.notes} onChange={setF('notes')} />
          </div>

          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button type="button" style={btn()} onClick={() => setEditing(false)}>Cancel</button>
            <button type="submit" style={btn('primary')}>Save</button>
          </div>
        </form>
      )}

      {!data && !editing && (
        <div style={{ ...card, textAlign:'center', color:'var(--text2)', padding:40 }}>
          <div style={{ fontSize:32, marginBottom:12 }}>🎯</div>
          <div style={{ fontWeight:600, marginBottom:8 }}>No risk appetite defined yet</div>
          {canEdit && <button style={btn('primary')} onClick={startEdit}>Define Risk Appetite</button>}
        </div>
      )}
    </div>
  );
}

/* ── Main GRCHub ──────────────────────────────────────────────── */

const TABS = [
  { id:'programs',  label:'Programs',           icon:'🏗' },
  { id:'documents', label:'Document Library',   icon:'📁' },
  { id:'controls',  label:'Control Register',   icon:'🛡' },
  { id:'tasks',     label:'Action Tracker',     icon:'✅' },
  { id:'reviews',   label:'Reviews & Audits',   icon:'📋' },
  { id:'raci',      label:'RACI Matrices',      icon:'📊' },
  { id:'suppliers', label:'Supplier Register',  icon:'🏢' },
  { id:'ai_systems',label:'AI Systems',         icon:'🤖' },
  { id:'steering',  label:'Steering Committee', icon:'👔' },
  { id:'appetite',  label:'Risk Appetite',      icon:'🎯' },
];

export default function GRCHub() {
  const { user }    = useContext(AuthContext);
  const [tab,       setTab]       = useState('programs');
  const [summary,   setSummary]   = useState(null);

  useEffect(() => {
    api.get('/grc/summary').then(r => setSummary(r.data)).catch(() => {});
  }, [tab]);

  const sumCount = (arr, key, val) => {
    const row = arr?.find(r => r[key||'status'] === val);
    return parseInt(row?.count || 0, 10);
  };

  const totalDocs = summary?.documents?.reduce((s, r) => s + parseInt(r.count || 0, 10), 0) || 0;
  const openTasks = sumCount(summary?.tasks, 'status', 'open') + sumCount(summary?.tasks, 'status', 'in_progress');

  return (
    <div style={{ padding:24, maxWidth:1400, margin:'0 auto' }}>
      {/* Page header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24, flexWrap:'wrap', gap:16 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:800, margin:0, color:'var(--text1)' }}>GRC Hub</h1>
          <div style={{ fontSize:13, color:'var(--text3)', marginTop:4 }}>
            Governance · Risk · Compliance — ISO 27001 · NIST CSF 2.0 · ISO 42001
          </div>
        </div>
        {summary && (
          <div style={{ display:'flex', gap:10 }}>
            {[
              { label:'Active Programs', val: sumCount(summary.programs,'status','active'),   color:'#10b981' },
              { label:'Open Tasks',      val: openTasks,                                      color:'#3b82f6' },
              { label:'Documents',       val: totalDocs,                                      color:'#8b5cf6' },
              { label:'Controls',        val: summary.controls?.reduce((s,r)=>s+parseInt(r.count||0,10),0)||0, color:'#f59e0b' },
            ].map(s => (
              <div key={s.label} style={{ textAlign:'center', background:'var(--surface2)', border:'1px solid var(--border1)', borderRadius:10, padding:'10px 16px', minWidth:80 }}>
                <div style={{ fontSize:22, fontWeight:800, color:s.color }}>{s.val}</div>
                <div style={{ fontSize:10, color:'var(--text3)', whiteSpace:'nowrap', marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', gap:2, borderBottom:'2px solid var(--border1)', marginBottom:24, overflowX:'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ background:'none', border:'none', padding:'10px 16px', cursor:'pointer', fontSize:13, fontWeight:600,
              color: tab===t.id ? 'var(--accent)' : 'var(--text3)',
              borderBottom: tab===t.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom:-2, transition:'color 0.15s', whiteSpace:'nowrap' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'programs'  && <ProgramsTab  user={user} />}
      {tab === 'documents' && <DocumentsTab user={user} />}
      {tab === 'controls'  && <ControlsTab  user={user} />}
      {tab === 'tasks'     && <TasksTab     user={user} />}
      {tab === 'reviews'   && <ReviewsTab   user={user} />}
      {tab === 'raci'      && <RACITab      user={user} />}
      {tab === 'suppliers' && <SuppliersTab user={user} />}
      {tab === 'ai_systems'&& <AISystemsTab user={user} />}
      {tab === 'steering'  && <SteeringTab  user={user} />}
      {tab === 'appetite'  && <AppetiteTab  user={user} />}
    </div>
  );
}
