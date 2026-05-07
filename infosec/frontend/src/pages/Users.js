import React, { useState, useEffect, useCallback, useContext } from 'react';
import { api, AuthContext } from '../App';
import { format } from 'date-fns';
import PasswordStrength from '../components/PasswordStrength';

const ROLES = [
  { value: 'viewer',  label: 'Viewer — read-only' },
  { value: 'analyst', label: 'Analyst — can create/edit' },
  { value: 'auditor', label: 'Auditor — read + reports' },
  { value: 'admin',   label: 'Admin — full access' },
];

const ROLE_BADGE = { admin: 'badge-critical', analyst: 'badge-medium', auditor: 'badge-info', viewer: 'badge-low' };

export default function Users() {
  const { user: currentUser } = useContext(AuthContext);
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(false);
  const [editModal, setEditModal] = useState(null);   // user object being edited
  const [resetModal, setResetModal] = useState(null); // user object
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm]     = useState({ username:'', email:'', password:'', full_name:'', role:'analyst', department:'' });
  const [editForm, setEditForm] = useState({});
  const [resetPw, setResetPw]   = useState('');
  const [err, setErr]           = useState('');
  const [editErr, setEditErr]   = useState('');
  const [resetErr, setResetErr] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [deleteErr, setDeleteErr] = useState('');
  const set     = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const setEdit = k => e => setEditForm(p => ({ ...p, [k]: e.target.value }));

  const load = useCallback(() => {
    setLoading(true);
    api.get('/users').then(r => { setUsers(r.data); setLoading(false); });
  }, []);
  useEffect(() => { load(); }, [load]);

  // ── Create user ────────────────────────────────────────────────
  const submit = async e => {
    e.preventDefault(); setErr('');
    try { await api.post('/users', form); setModal(false); setForm({ username:'', email:'', password:'', full_name:'', role:'analyst', department:'' }); load(); }
    catch(ex) { setErr(ex.response?.data?.error || 'Error'); }
  };

  // ── Edit user ──────────────────────────────────────────────────
  const openEdit = u => { setEditModal(u); setEditForm({ full_name: u.full_name||'', email: u.email||'', role: u.role, department: u.department||'' }); setEditErr(''); };
  const submitEdit = async e => {
    e.preventDefault(); setEditErr('');
    try {
      await api.patch(`/users/${editModal.id}`, editForm);
      setEditModal(null);
      load();
    } catch(ex) { setEditErr(ex.response?.data?.error || 'Error'); }
  };

  // ── Toggle active ──────────────────────────────────────────────
  const toggle = async (id, is_active) => {
    try { await api.patch(`/users/${id}`, { is_active }); load(); }
    catch(ex) { alert(ex.response?.data?.error || 'Error'); }
  };

  // ── Reset password ────────────────────────────────────────────
  const openReset = u => { setResetModal(u); setResetPw(''); setResetErr(''); setResetMsg(''); };
  const submitReset = async e => {
    e.preventDefault(); setResetErr(''); setResetMsg('');
    try {
      const r = await api.post(`/users/${resetModal.id}/reset-password`, { password: resetPw });
      setResetMsg(r.data.message);
      setResetPw('');
    } catch(ex) { setResetErr(ex.response?.data?.error || 'Error'); }
  };

  // ── Delete user ────────────────────────────────────────────────
  const confirmDelete = async () => {
    setDeleteErr('');
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
    } catch(ex) { setDeleteErr(ex.response?.data?.error || 'Error'); }
  };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">User Management</div><div className="page-subtitle">{users.length} users</div></div>
        <button className="btn btn-primary" onClick={() => { setModal(true); setErr(''); }}>+ Add User</button>
      </div>

      <div className="card" style={{padding:0}}>
        <div className="table-wrap">
          {loading ? <div className="empty-state"><div className="spinner"/></div> :
          <table>
            <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Department</th><th>Last Login</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:28,height:28,borderRadius:'50%',background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:600,flexShrink:0}}>
                        {u.username[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{fontWeight:500}}>{u.full_name || u.username}</div>
                        <div style={{fontSize:11,color:'var(--text3)'}}>@{u.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-muted">{u.email}</td>
                  <td><span className={`badge ${ROLE_BADGE[u.role]||'badge-info'}`}>{u.role}</span></td>
                  <td className="text-muted">{u.department || '—'}</td>
                  <td className="text-dim">{u.last_login ? format(new Date(u.last_login),'MMM d, HH:mm') : 'Never'}</td>
                  <td>
                    <span className={`status-dot ${u.is_active?'dot-completed':'dot-pending'}`}/>
                    {u.is_active ? 'Active' : 'Disabled'}
                  </td>
                  <td style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    <button className="btn btn-sm btn-secondary" onClick={() => openEdit(u)}>Edit</button>
                    <button className={`btn btn-sm ${u.is_active?'btn-danger':'btn-secondary'}`}
                      onClick={() => toggle(u.id, !u.is_active)}>
                      {u.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button className="btn btn-sm btn-secondary" onClick={() => openReset(u)}>Reset PW</button>
                    {u.id !== currentUser?.id && (
                      <button className="btn btn-sm btn-danger" onClick={() => { setDeleteTarget(u); setDeleteErr(''); }}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>}
        </div>
      </div>

      {/* ── Add User Modal ─────────────────────────────────────── */}
      {modal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal">
            <div className="modal-header"><h2>Add User</h2><button className="modal-close" onClick={()=>setModal(false)}>✕</button></div>
            <form onSubmit={submit}>
              <div className="modal-body">
                {err && <div className="alert alert-error">{err}</div>}
                <div className="alert" style={{background:'rgba(99,102,241,0.08)',border:'1px solid rgba(99,102,241,0.25)',borderRadius:'var(--radius)',padding:'8px 12px',fontSize:12,color:'var(--text2)',marginBottom:12}}>
                  The user will be required to change this password on first login.
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Username *</label><input value={form.username} onChange={set('username')} required maxLength={50} /></div>
                  <div className="form-group"><label>Email *</label><input type="email" value={form.email} onChange={set('email')} required maxLength={100} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Full Name</label><input value={form.full_name} onChange={set('full_name')} maxLength={100} /></div>
                  <div className="form-group"><label>Department</label><input value={form.department} onChange={set('department')} maxLength={100} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Role</label>
                    <select value={form.role} onChange={set('role')}>
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Temporary Password *</label>
                    <input type="password" value={form.password} onChange={set('password')} required minLength={12} placeholder="Min 12 characters" />
                    <PasswordStrength password={form.password} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit User Modal ────────────────────────────────────── */}
      {editModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setEditModal(null)}>
          <div className="modal" style={{maxWidth:500}}>
            <div className="modal-header">
              <h2>Edit User — @{editModal.username}</h2>
              <button className="modal-close" onClick={()=>setEditModal(null)}>✕</button>
            </div>
            <form onSubmit={submitEdit}>
              <div className="modal-body">
                {editErr && <div className="alert alert-error">{editErr}</div>}
                <div className="form-row">
                  <div className="form-group"><label>Full Name</label><input value={editForm.full_name} onChange={setEdit('full_name')} maxLength={100} /></div>
                  <div className="form-group"><label>Email *</label><input type="email" value={editForm.email} onChange={setEdit('email')} required maxLength={100} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Role</label>
                    <select value={editForm.role} onChange={setEdit('role')}>
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Department</label><input value={editForm.department} onChange={setEdit('department')} maxLength={100} /></div>
                </div>
                <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>
                  Changes are logged to the audit trail.
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setEditModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ───────────────────────────────── */}
      {resetModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setResetModal(null)}>
          <div className="modal" style={{maxWidth:420}}>
            <div className="modal-header">
              <h2>Reset Password</h2>
              <button className="modal-close" onClick={()=>setResetModal(null)}>✕</button>
            </div>
            <form onSubmit={submitReset}>
              <div className="modal-body">
                <div style={{marginBottom:14,fontSize:13,color:'var(--text2)'}}>
                  Resetting password for <strong>{resetModal.full_name || resetModal.username}</strong> (@{resetModal.username}).
                  The user will be required to change it on next login.
                </div>
                {resetErr && <div className="alert alert-error" style={{marginBottom:12}}>{resetErr}</div>}
                {resetMsg && <div className="alert alert-success" style={{marginBottom:12}}>{resetMsg}</div>}
                <div className="form-group">
                  <label>New Temporary Password *</label>
                  <input type="password" value={resetPw} onChange={e=>setResetPw(e.target.value)}
                    required minLength={12} placeholder="Min 12 characters" autoFocus />
                  <PasswordStrength password={resetPw} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setResetModal(null)}>Close</button>
                <button type="submit" className="btn btn-primary">Reset Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ────────────────────────────────── */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setDeleteTarget(null)}>
          <div className="modal" style={{maxWidth:400}}>
            <div className="modal-header">
              <h2>Delete User</h2>
              <button className="modal-close" onClick={()=>setDeleteTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{fontSize:14,color:'var(--text1)',marginBottom:8}}>
                Are you sure you want to permanently delete <strong>{deleteTarget.full_name || deleteTarget.username}</strong> (@{deleteTarget.username})?
              </p>
              <p style={{fontSize:13,color:'var(--text3)',marginBottom:0}}>This action cannot be undone and will be logged in the audit trail.</p>
              {deleteErr && <div className="alert alert-error" style={{marginTop:12}}>{deleteErr}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete}>Delete Permanently</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
