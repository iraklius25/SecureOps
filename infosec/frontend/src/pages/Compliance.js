import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../App';
import * as XLSX from 'xlsx';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

/* ─── Posture constants (unchanged) ─────────────────── */
const STATUS_COLORS = {
  compliant:     'var(--low)',
  partial:       'var(--medium)',
  non_compliant: 'var(--critical)',
  not_assessed:  'var(--text3)',
};
const STATUS_LABELS = {
  compliant: 'Compliant', partial: 'Partial',
  non_compliant: 'Non-Compliant', not_assessed: 'Not Assessed',
};

/* ─── Gap Assessment constants ───────────────────────── */
const PIE_COLORS = [
  '#22c55e','#ef4444','#eab308','#38bdf8',
  '#f97316','#8b5cf6','#ec4899','#06b6d4','#14b8a6','#f43f5e',
];
const uid = () => Math.random().toString(36).slice(2, 9);

const DEFAULT_COLUMNS = [
  'Control ID', 'Control Name', 'Requirement',
  'Current State', 'Status', 'Gap Description', 'Owner', 'Target Date',
];

/* ─── PostureBar (unchanged) ─────────────────────────── */
function PostureBar({ compliant, partial, non_compliant, total }) {
  const c = parseInt(compliant)     || 0;
  const p = parseInt(partial)       || 0;
  const n = parseInt(non_compliant) || 0;
  const score = total > 0 ? Math.round(((c + p * 0.5) / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display:'flex', height:8, borderRadius:4, overflow:'hidden', background:'var(--bg3)', gap:1 }}>
        {c > 0 && <div style={{ flex:c, background:STATUS_COLORS.compliant    }} title={`Compliant: ${c}`} />}
        {p > 0 && <div style={{ flex:p, background:STATUS_COLORS.partial      }} title={`Partial: ${p}`} />}
        {n > 0 && <div style={{ flex:n, background:STATUS_COLORS.non_compliant}} title={`Non-Compliant: ${n}`} />}
        {(total-c-p-n) > 0 && <div style={{ flex:total-c-p-n, background:'var(--bg3)' }} />}
      </div>
      <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>
        Posture score:{' '}
        <span style={{ color: score>=70?'var(--low)':score>=40?'var(--medium)':'var(--critical)', fontWeight:600 }}>{score}%</span>
        {' · '}{c} compliant · {p} partial · {n} non-compliant · {total-c-p-n} not assessed
      </div>
    </div>
  );
}

/* ─── SpreadsheetGrid ────────────────────────────────── */
function SpreadsheetGrid({ columns, rows, onColumnsChange, onRowsChange }) {
  const [editCell,    setEditCell]    = useState(null); // {r,c}
  const [editVal,     setEditVal]     = useState('');
  const [editColIdx,  setEditColIdx]  = useState(null);
  const [editColVal,  setEditColVal]  = useState('');
  const inputRef = useRef();

  useEffect(() => { if (editCell && inputRef.current) inputRef.current.focus(); }, [editCell]);

  /* ── cell editing ── */
  const startCell = (r, c) => { setEditCell({ r, c }); setEditVal(rows[r]?.[c] ?? ''); setEditColIdx(null); };

  const commitCell = useCallback(() => {
    if (!editCell) return;
    const newRows = rows.map((row, ri) => {
      if (ri !== editCell.r) return row;
      const nr = [...row]; nr[editCell.c] = editVal; return nr;
    });
    onRowsChange(newRows);
    setEditCell(null);
  }, [editCell, editVal, rows, onRowsChange]);

  const handleCellKey = (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); commitCell(); }
    if (e.key === 'Escape') { setEditCell(null); }
    if (e.key === 'Tab') {
      e.preventDefault(); commitCell();
      if (editCell) {
        const nc = (editCell.c + 1) % columns.length;
        const nr = editCell.c + 1 >= columns.length ? editCell.r + 1 : editCell.r;
        if (nr < rows.length) setTimeout(() => startCell(nr, nc), 0);
      }
    }
  };

  /* ── column header editing ── */
  const startCol = (ci, e) => { e.stopPropagation(); setEditColIdx(ci); setEditColVal(columns[ci]); setEditCell(null); };
  const commitCol = () => {
    if (editColIdx === null) return;
    onColumnsChange(columns.map((c, i) => i === editColIdx ? (editColVal.trim() || c) : c));
    setEditColIdx(null);
  };

  /* ── add / delete ── */
  const addRow = () => onRowsChange([...rows, columns.map(() => '')]);
  const addCol = () => {
    onColumnsChange([...columns, `Column ${columns.length + 1}`]);
    onRowsChange(rows.map(r => [...r, '']));
  };
  const delRow = (ri, e) => { e.stopPropagation(); onRowsChange(rows.filter((_, i) => i !== ri)); };
  const delCol = (ci, e) => {
    e.stopPropagation();
    onColumnsChange(columns.filter((_, i) => i !== ci));
    onRowsChange(rows.map(r => r.filter((_, i) => i !== ci)));
  };

  /* ── styles ── */
  const tdBase = {
    padding: '4px 8px', fontSize: 12, border: '1px solid var(--border)',
    cursor: 'pointer', minWidth: 90, maxWidth: 220,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    color: 'var(--text)', background: 'var(--bg)',
  };
  const inputStyle = {
    width: '100%', border: 'none',
    outline: '2px solid var(--primary)', outlineOffset: -2,
    padding: '4px 8px', fontSize: 12,
    background: 'var(--bg)', color: 'var(--text)', borderRadius: 0,
  };

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:10 }}>
        <button className="btn btn-secondary btn-sm" onClick={addRow}>+ Row</button>
        <button className="btn btn-secondary btn-sm" onClick={addCol}>+ Column</button>
      </div>

      <div style={{ overflowX:'auto', border:'1px solid var(--border)', borderRadius:6 }}>
        <table style={{ borderCollapse:'collapse', tableLayout:'auto', minWidth:'100%' }}>
          <thead>
            <tr style={{ background:'var(--bg3)' }}>
              {/* row-number header */}
              <th style={{ padding:'6px 8px', border:'1px solid var(--border)', fontSize:11, color:'var(--text3)', width:36, textAlign:'center' }}>#</th>

              {columns.map((col, ci) => (
                <th key={ci} style={{ padding:'4px 8px', border:'1px solid var(--border)', fontSize:11, fontWeight:600, color:'var(--text2)', minWidth:100 }}>
                  {editColIdx === ci ? (
                    <input
                      autoFocus
                      value={editColVal}
                      onChange={e => setEditColVal(e.target.value)}
                      onBlur={commitCol}
                      onKeyDown={e => { if (e.key==='Enter'||e.key==='Tab') { e.preventDefault(); commitCol(); } if (e.key==='Escape') setEditColIdx(null); }}
                      style={{ width:'100%', border:'none', outline:'2px solid var(--primary)', padding:'2px 4px', fontSize:11, background:'var(--bg)', color:'var(--text)', borderRadius:0 }}
                    />
                  ) : (
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:4 }}>
                      <span style={{ flex:1, cursor:'pointer' }} onClick={e => startCol(ci, e)} title="Click to rename">{col}</span>
                      <button
                        onClick={e => delCol(ci, e)}
                        style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:10, padding:'0 2px', lineHeight:1 }}
                        title="Delete column"
                      >✕</button>
                    </div>
                  )}
                </th>
              ))}

              {/* delete-row header spacer */}
              <th style={{ padding:'6px 8px', border:'1px solid var(--border)', width:30 }} />
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} style={{ textAlign:'center', padding:24, color:'var(--text3)', fontSize:12 }}>
                  No rows yet — click "+ Row" to add one.
                </td>
              </tr>
            )}
            {rows.map((row, ri) => (
              <tr key={ri} style={{ background: ri%2===0 ? 'var(--bg)' : 'var(--bg2)' }}>
                {/* row number */}
                <td style={{ padding:'4px 8px', border:'1px solid var(--border)', fontSize:10, color:'var(--text3)', textAlign:'center', userSelect:'none' }}>{ri+1}</td>

                {columns.map((_, ci) => {
                  const isEditing = editCell?.r===ri && editCell?.c===ci;
                  return (
                    <td
                      key={ci}
                      style={isEditing ? { ...tdBase, padding:0 } : tdBase}
                      onClick={() => { if (!isEditing) startCell(ri, ci); }}
                    >
                      {isEditing ? (
                        <input
                          ref={inputRef}
                          value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          onBlur={commitCell}
                          onKeyDown={handleCellKey}
                          style={inputStyle}
                        />
                      ) : (
                        <span style={{ display:'block', minHeight:20 }}>{row[ci] ?? ''}</span>
                      )}
                    </td>
                  );
                })}

                {/* delete row */}
                <td style={{ padding:'4px 6px', border:'1px solid var(--border)', textAlign:'center' }}>
                  <button
                    onClick={e => delRow(ri, e)}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:12, lineHeight:1 }}
                    title="Delete row"
                  >✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize:11, color:'var(--text3)', marginTop:6 }}>
        {rows.length} row{rows.length!==1?'s':''} · {columns.length} column{columns.length!==1?'s':''}
        {' · '}Click a cell to edit · Click a column header to rename it
      </div>
    </div>
  );
}

/* ─── ChartCard ──────────────────────────────────────── */
function ChartCard({ chart, sheets, onDelete }) {
  const sheet = sheets[chart.sheetIndex];
  if (!sheet) return null;

  const counts = {};
  (sheet.rows || []).forEach(row => {
    const val = (row[chart.colIndex] ?? '').trim();
    if (val) counts[val] = (counts[val] || 0) + 1;
  });
  const data = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));

  return (
    <div className="card" style={{ minWidth:300, maxWidth:420, flex:'0 0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
        <div>
          <div style={{ fontWeight:600, fontSize:13 }}>{chart.title}</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>{sheet.name} → {sheet.columns?.[chart.colIndex]}</div>
        </div>
        <button onClick={onDelete} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:16, lineHeight:1 }}>✕</button>
      </div>

      {data.length === 0 ? (
        <div className="empty-state" style={{ padding:20, fontSize:12 }}>No data in selected column</div>
      ) : (
        <ResponsiveContainer width="100%" height={230}>
          <PieChart>
            <Pie
              data={data} dataKey="value" nameKey="name"
              cx="50%" cy="48%" outerRadius={78}
              label={({ name, percent }) => `${(percent*100).toFixed(0)}%`}
              labelLine={false} fontSize={10}
            >
              {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v, n) => [v, n]} />
            <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize:11 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

/* ─── AddChartModal ──────────────────────────────────── */
function AddChartModal({ sheets, onAdd, onClose }) {
  const [title,    setTitle]    = useState('Status Distribution');
  const [sheetIdx, setSheetIdx] = useState(0);
  const [colIdx,   setColIdx]   = useState(0);

  const sheet = sheets[sheetIdx] || { columns: [], rows: [] };

  const previewData = (() => {
    const counts = {};
    (sheet.rows || []).forEach(row => {
      const val = (row[colIdx] ?? '').trim();
      if (val) counts[val] = (counts[val] || 0) + 1;
    });
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value}));
  })();

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:540 }}>
        <div className="modal-header">
          <h2>Add Pie Chart</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Chart Title</label>
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Status Distribution" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Sheet</label>
              <select value={sheetIdx} onChange={e=>{ setSheetIdx(+e.target.value); setColIdx(0); }}>
                {sheets.map((s,i)=><option key={i} value={i}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Count values in column</label>
              <select value={colIdx} onChange={e=>setColIdx(+e.target.value)}>
                {(sheet.columns||[]).map((col,i)=><option key={i} value={i}>{col}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginTop:8 }}>
            <div style={{ fontSize:12, color:'var(--text2)', marginBottom:6 }}>Preview</div>
            {previewData.length === 0 ? (
              <div className="empty-state" style={{ padding:20, fontSize:12 }}>No data in selected column</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={previewData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65}
                    label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                    {previewData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                  </Pie>
                  <Tooltip />
                  <Legend iconSize={10} wrapperStyle={{fontSize:11}} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!title.trim() || previewData.length===0}
            onClick={() => onAdd({ id:uid(), title, sheetIndex:sheetIdx, colIndex:colIdx })}
          >Add Chart</button>
        </div>
      </div>
    </div>
  );
}

/* ─── GapAssessmentEditor ────────────────────────────── */
function GapAssessmentEditor({ assessment, onBack, onSaved }) {
  const isNew = !assessment.id;
  const idRef = useRef(assessment.id || null);

  const [name,          setName]          = useState(assessment.name || 'New ISO Gap Assessment');
  const [data,          setData]          = useState(
    assessment.data || {
      sheets: [{ id:uid(), name:'Sheet 1', columns:[...DEFAULT_COLUMNS], rows:[] }],
      charts: [],
    }
  );
  const [activeSheet,   setActiveSheet]   = useState(0);
  const [saving,        setSaving]        = useState(false);
  const [savedOk,       setSavedOk]       = useState(false);
  const [showChartModal,setShowChartModal]= useState(false);
  const [editSheetIdx,  setEditSheetIdx]  = useState(null);
  const [editSheetVal,  setEditSheetVal]  = useState('');

  /* ── save ── */
  const save = async () => {
    setSaving(true);
    try {
      if (idRef.current) {
        await api.put(`/compliance/gap/${idRef.current}`, { name, data });
      } else {
        const r = await api.post('/compliance/gap', { name, data });
        idRef.current = r.data.id;
      }
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2000);
      onSaved?.();
    } catch(e) {
      alert('Save failed: ' + (e.response?.data?.error || e.message));
    } finally { setSaving(false); }
  };

  /* ── sheet helpers ── */
  const updateSheet = (idx, updater) =>
    setData(d => ({ ...d, sheets: d.sheets.map((s, i) => i===idx ? updater(s) : s) }));

  const addSheet = () => {
    const s = { id:uid(), name:`Sheet ${data.sheets.length+1}`, columns:[...DEFAULT_COLUMNS], rows:[] };
    setData(d => ({ ...d, sheets:[...d.sheets, s] }));
    setActiveSheet(data.sheets.length);
  };

  const deleteSheet = (idx) => {
    if (data.sheets.length === 1) return alert('Cannot delete the last sheet.');
    if (!window.confirm(`Delete sheet "${data.sheets[idx].name}"?`)) return;
    setData(d => ({
      ...d,
      sheets: d.sheets.filter((_, i) => i !== idx),
      charts: d.charts
        .filter(c => c.sheetIndex !== idx)
        .map(c => ({ ...c, sheetIndex: c.sheetIndex > idx ? c.sheetIndex - 1 : c.sheetIndex })),
    }));
    setActiveSheet(s => Math.max(0, s >= idx ? s - 1 : s));
  };

  const startRenameSheet = (idx, e) => {
    e.stopPropagation();
    setEditSheetIdx(idx);
    setEditSheetVal(data.sheets[idx].name);
  };
  const commitRenameSheet = () => {
    if (editSheetIdx === null) return;
    setData(d => ({ ...d, sheets: d.sheets.map((s,i) => i===editSheetIdx ? { ...s, name: editSheetVal.trim()||s.name } : s) }));
    setEditSheetIdx(null);
  };

  /* ── chart helpers ── */
  const addChart   = (chart) => { setData(d => ({ ...d, charts:[...d.charts, chart] })); setShowChartModal(false); };
  const deleteChart = (id)   =>   setData(d => ({ ...d, charts: d.charts.filter(c => c.id!==id) }));

  const sheet = data.sheets[activeSheet];

  return (
    <div>
      {/* ── header ── */}
      <div className="page-header" style={{ flexWrap:'wrap', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button className="btn btn-secondary btn-sm" onClick={onBack}>← Back</button>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ fontSize:18, fontWeight:700, background:'none', border:'none',
                     borderBottom:'2px solid var(--border)', outline:'none',
                     color:'var(--text)', minWidth:220, padding:'2px 0' }}
          />
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {savedOk && <span style={{ fontSize:12, color:'var(--low)' }}>✓ Saved</span>}
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* ── sheet tabs ── */}
      <div style={{ display:'flex', alignItems:'center', borderBottom:'2px solid var(--border)', marginBottom:16, flexWrap:'wrap', gap:0 }}>
        {data.sheets.map((s, idx) => (
          <div
            key={s.id || idx}
            onClick={() => { setActiveSheet(idx); setEditSheetIdx(null); }}
            style={{
              padding:'8px 14px', cursor:'pointer', userSelect:'none',
              borderBottom: activeSheet===idx ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom:-2,
              fontWeight: activeSheet===idx ? 600 : 400,
              color: activeSheet===idx ? 'var(--primary)' : 'var(--text2)',
              fontSize:13,
              display:'flex', alignItems:'center', gap:6,
            }}
          >
            {editSheetIdx===idx ? (
              <input
                autoFocus
                value={editSheetVal}
                onChange={e=>setEditSheetVal(e.target.value)}
                onBlur={commitRenameSheet}
                onKeyDown={e=>{ if(e.key==='Enter') commitRenameSheet(); if(e.key==='Escape') setEditSheetIdx(null); }}
                onClick={e=>e.stopPropagation()}
                style={{ width:100, fontSize:12, padding:'1px 4px', border:'1px solid var(--border)', borderRadius:3 }}
              />
            ) : (
              <>
                <span onDoubleClick={e=>startRenameSheet(idx,e)} title="Double-click to rename">{s.name}</span>
                {data.sheets.length > 1 && (
                  <span
                    onClick={e=>{ e.stopPropagation(); deleteSheet(idx); }}
                    style={{ fontSize:10, color:'var(--text3)', cursor:'pointer', lineHeight:1, opacity:0.7 }}
                    title="Delete sheet"
                  >✕</span>
                )}
              </>
            )}
          </div>
        ))}
        <button
          onClick={addSheet}
          style={{ padding:'8px 12px', background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:16, lineHeight:1 }}
          title="Add sheet"
        >+</button>
      </div>

      {/* ── grid ── */}
      {sheet && (
        <div className="card" style={{ marginBottom:24 }}>
          <SpreadsheetGrid
            columns={sheet.columns || []}
            rows={sheet.rows || []}
            onColumnsChange={cols => updateSheet(activeSheet, s => ({ ...s, columns:cols }))}
            onRowsChange={rows  => updateSheet(activeSheet, s => ({ ...s, rows }))}
          />
        </div>
      )}

      {/* ── charts section ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ fontWeight:600, fontSize:14 }}>Pie Charts</div>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowChartModal(true)}>+ Add Chart</button>
      </div>

      {data.charts.length === 0 ? (
        <div style={{ fontSize:12, color:'var(--text3)', paddingBottom:16 }}>
          No charts yet. Click "+ Add Chart" to generate a pie chart from any column (e.g. Status).
        </div>
      ) : (
        <div style={{ display:'flex', flexWrap:'wrap', gap:16, marginBottom:24 }}>
          {data.charts.map(chart => (
            <ChartCard key={chart.id} chart={chart} sheets={data.sheets} onDelete={() => deleteChart(chart.id)} />
          ))}
        </div>
      )}

      {showChartModal && (
        <AddChartModal sheets={data.sheets} onAdd={addChart} onClose={() => setShowChartModal(false)} />
      )}
    </div>
  );
}

/* ─── GapAssessmentSection (list + import) ───────────── */
function GapAssessmentSection() {
  const [assessments, setAssessments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [editing,     setEditing]     = useState(null); // null = list, object = editor
  const fileInputRef = useRef();

  const load = useCallback(() => {
    setLoading(true);
    api.get('/compliance/gap')
      .then(r => setAssessments(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── open existing ── */
  const openExisting = async (a) => {
    try {
      const r = await api.get(`/compliance/gap/${a.id}`);
      setEditing(r.data);
    } catch(e) { alert('Failed to load assessment'); }
  };

  /* ── import Excel ── */
  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, { type:'array' });
      const sheets = wb.SheetNames.map(sheetName => {
        const ws  = wb.Sheets[sheetName];
        const raw = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
        const columns = (raw[0] || []).map(String);
        const rows    = raw.slice(1).map(row => columns.map((_, ci) => String(row[ci] ?? '')));
        return { id:uid(), name:sheetName, columns, rows };
      });
      setEditing({
        name: file.name.replace(/\.[^.]+$/, ''),
        data: { sheets, charts:[] },
      });
    } catch(err) {
      alert('Failed to parse Excel file: ' + err.message);
    }
  };

  /* ── delete assessment ── */
  const deleteAssessment = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Permanently delete this gap assessment?')) return;
    try { await api.delete(`/compliance/gap/${id}`); load(); }
    catch(e) { alert(e.response?.data?.error || 'Delete failed'); }
  };

  /* ── editor view ── */
  if (editing !== null) {
    return (
      <GapAssessmentEditor
        assessment={editing}
        onBack={() => { setEditing(null); load(); }}
        onSaved={load}
      />
    );
  }

  /* ── list view ── */
  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }} onChange={handleImport} />
        <button className="btn btn-primary" onClick={() => fileInputRef.current.click()}>
          ↑ Import Excel (.xlsx / .xls / .csv)
        </button>
        <button className="btn btn-secondary" onClick={() => setEditing({ name:'New ISO Gap Assessment', data:null })}>
          + New Blank Assessment
        </button>
      </div>

      {loading ? (
        <div className="empty-state"><div className="spinner" /></div>
      ) : assessments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <p>No gap assessments yet.</p>
          <p style={{ fontSize:12, color:'var(--text3)' }}>
            Import your Excel file or create a blank assessment to get started.
          </p>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px,1fr))', gap:16 }}>
          {assessments.map(a => (
            <div key={a.id} className="card" style={{ cursor:'pointer' }} onClick={() => openExisting(a)}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:14, marginBottom:4 }}>{a.name}</div>
                  {a.description && <div style={{ fontSize:12, color:'var(--text2)', marginBottom:4 }}>{a.description}</div>}
                  <div style={{ fontSize:11, color:'var(--text3)' }}>
                    Updated {new Date(a.updated_at).toLocaleDateString()}
                  </div>
                </div>
                <button className="btn btn-danger btn-sm" onClick={e => deleteAssessment(a.id, e)}>Del</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main Compliance Page ───────────────────────────── */
export default function Compliance() {
  const [posture,   setPosture]   = useState(null);
  const [framework, setFramework] = useState('NIST_CSF');
  const [loading,   setLoading]   = useState(true);
  const [expanded,  setExpanded]  = useState(null);
  const [mainTab,   setMainTab]   = useState('posture'); // 'posture' | 'gap'

  useEffect(() => {
    api.get('/compliance/posture')
      .then(r => { setPosture(r.data.frameworks); })
      .catch(e => { console.error(e); setPosture({}); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty-state"><div className="spinner" /></div>;

  const fw = posture?.[framework];
  const categories = fw ? [...new Set(fw.controls.map(c => c.category))].sort() : [];
  const byCategory = {};
  (fw?.controls || []).forEach(c => {
    if (!byCategory[c.category]) byCategory[c.category] = [];
    byCategory[c.category].push(c);
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Compliance</div>
          <div className="page-subtitle">NIST CSF 2.0 · ISO 27001 · PCI DSS · SOC 2 · GDPR · ISO 22301 · Gap Assessment</div>
        </div>
      </div>

      {/* ── main section tabs ── */}
      <div className="tabs" style={{ marginBottom:20 }}>
        <button className={`tab-btn ${mainTab==='posture'?'active':''}`} onClick={() => setMainTab('posture')}>
          Control Posture
        </button>
        <button className={`tab-btn ${mainTab==='gap'?'active':''}`} onClick={() => setMainTab('gap')}>
          ISO Gap Assessment
        </button>
      </div>

      {/* ── posture section (existing) ── */}
      {mainTab === 'posture' && (
        <>
          <div className="tabs" style={{ marginBottom:20 }}>
            {Object.keys(posture || {}).map(f => (
              <button key={f} className={`tab-btn ${framework===f?'active':''}`} onClick={() => setFramework(f)}>
                {f.replace('_',' ')}
              </button>
            ))}
          </div>

          {fw && (
            <>
              <div className="card" style={{ marginBottom:20 }}>
                <div className="card-title">{framework.replace('_',' ')} — Overall Posture</div>
                <PostureBar compliant={fw.compliant} partial={fw.partial} non_compliant={fw.non_compliant} total={fw.total} />
                <div style={{ display:'flex', gap:20 }}>
                  {Object.entries(STATUS_COLORS).map(([s, color]) => (
                    <div key={s} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
                      <div style={{ width:10, height:10, borderRadius:2, background:color }} />
                      <span style={{ color:'var(--text2)' }}>{STATUS_LABELS[s]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {categories.map(cat => (
                <div key={cat} className="card" style={{ marginBottom:16 }}>
                  <div className="card-title" style={{ marginBottom:12 }}>{cat}</div>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width:100 }}>Control ID</th>
                        <th>Control Name</th>
                        <th style={{ width:120 }}>Mapped Risks</th>
                        <th style={{ width:140 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byCategory[cat].map(ctrl => {
                        const mapped = parseInt(ctrl.mapped_risks) || 0;
                        const status = parseInt(ctrl.compliant) > 0 ? 'compliant'
                          : parseInt(ctrl.partial) > 0 ? 'partial'
                          : parseInt(ctrl.non_compliant) > 0 ? 'non_compliant'
                          : 'not_assessed';
                        return (
                          <tr key={ctrl.control_id} style={{ cursor:'pointer' }}
                            onClick={() => setExpanded(expanded===ctrl.control_id ? null : ctrl.control_id)}>
                            <td className="mono" style={{ color:'var(--info)', fontWeight:600 }}>{ctrl.control_id}</td>
                            <td>
                              <div style={{ fontWeight:500 }}>{ctrl.name}</div>
                              {expanded===ctrl.control_id && (
                                <div style={{ fontSize:12, color:'var(--text2)', marginTop:6, lineHeight:1.6 }}>
                                  {ctrl.description}
                                </div>
                              )}
                            </td>
                            <td className="mono">
                              {mapped > 0
                                ? <span style={{ color:'var(--info)' }}>{mapped}</span>
                                : <span className="text-dim">0</span>}
                            </td>
                            <td>
                              <span style={{ color:STATUS_COLORS[status], fontWeight:600, fontSize:12 }}>
                                {STATUS_LABELS[status]}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {/* ── ISO Gap Assessment section ── */}
      {mainTab === 'gap' && <GapAssessmentSection />}
    </div>
  );
}
