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
  const [filter,     setFilter]     = useState({ category:'', status:'', search:'' });
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
    if (filter.search   && !d.title.toLowerCase().includes(filter.search.toLowerCase())) return false;
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
        <span style={{ marginLeft:'auto', fontSize:13, color:'var(--text3)' }}>{filtered.length} document{filtered.length!==1?'s':''}</span>
      </div>

      <div style={{ overflowX:'auto' }}>
        <table style={tbl}>
          <thead>
            <tr>{['Title','Category','Ver.','Status','Owner','Review Date','File','Actions'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ ...td, textAlign:'center', color:'var(--text3)', padding:32 }}>No documents found</td></tr>
            )}
            {filtered.map(d => (
              <tr key={d.id}>
                <td style={td}>
                  <div style={{ fontWeight:600 }}>{d.title}</div>
                  {d.description && <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{d.description.slice(0,80)}{d.description.length>80?'…':''}</div>}
                </td>
                <td style={td}><span style={badge('#6b7280')}>{d.category}</span></td>
                <td style={td}><span style={{ fontSize:12, color:'var(--text3)' }}>v{d.doc_version}</span></td>
                <td style={td}><span style={badge(DC[d.status]||'#6b7280')}>{d.status}</span></td>
                <td style={td}>{d.owner||'—'}</td>
                <td style={td}>
                  {d.review_date
                    ? <span style={{ color: isOverdue(d.review_date)?'#ef4444':'var(--text1)', fontSize:13 }}>{fmtDate(d.review_date)}</span>
                    : '—'}
                </td>
                <td style={td}>
                  {d.stored_name
                    ? <a href={`/api/grc/documents/${d.id}/download`} style={{ color:'var(--accent)', textDecoration:'none', fontSize:12 }}>⬇ {fmtBytes(d.file_size)}</a>
                    : <span style={{ color:'var(--text3)', fontSize:12 }}>No file</span>}
                </td>
                <td style={td}>
                  {canEdit && (
                    <div style={{ display:'flex', gap:6 }}>
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

/* ── Tasks Tab ────────────────────────────────────────────────── */

function TasksTab({ user }) {
  const [tasks,    setTasks]    = useState([]);
  const [programs, setPrograms] = useState([]);
  const [filter,   setFilter]   = useState({ status:'', priority:'', framework:'', search:'' });
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ program_id:'', title:'', description:'', owner:'', due_date:'', priority:'medium', status:'open', framework:'', clause_ref:'' });
  const [err,      setErr]      = useState('');
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
                <tr key={t.id} style={{ opacity: t.status==='cancelled' ? 0.5 : 1 }}>
                  <td style={td}><span style={badge(PC[t.priority]||'#6b7280')}>{t.priority}</span></td>
                  <td style={td}>
                    <div style={{ fontWeight:500, textDecoration: t.status==='completed'?'line-through':'' }}>{t.title}</div>
                    {t.description && <div style={{ fontSize:11, color:'var(--text3)' }}>{t.description.slice(0,60)}{t.description.length>60?'…':''}</div>}
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Reviews Tab ──────────────────────────────────────────────── */

function ReviewsTab({ user }) {
  const [reviews,  setReviews]  = useState([]);
  const [programs, setPrograms] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState(null);
  const blank = { program_id:'', review_date:'', review_type:'management_review', title:'', chair:'', status:'planned', minutes_text:'', approved_by:'' };
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
    setForm({ ...r, review_date: r.review_date?.slice(0,10)||'' });
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
              {r.minutes_text && (
                <div style={{ fontSize:13, color:'var(--text2)', background:'var(--surface3)', borderRadius:6, padding:'10px 14px', whiteSpace:'pre-wrap', maxHeight:120, overflow:'auto', lineHeight:1.5 }}>
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

/* ── Main GRCHub ──────────────────────────────────────────────── */

const TABS = [
  { id:'programs',  label:'Programs',         icon:'🏗' },
  { id:'documents', label:'Document Library', icon:'📁' },
  { id:'controls',  label:'Control Register', icon:'🛡' },
  { id:'tasks',     label:'Action Tracker',   icon:'✅' },
  { id:'reviews',   label:'Reviews & Audits', icon:'📋' },
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
    </div>
  );
}
