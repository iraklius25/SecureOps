import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../App';
import { format } from 'date-fns';
import PasswordStrength from '../components/PasswordStrength';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(false);
  const [resetModal, setResetModal] = useState(null); // user object
  const [form, setForm] = useState({ username:'', email:'', password:'', full_name:'', role:'analyst', department:'' });
  const [resetPw, setResetPw] = useState('');
  const [err, setErr] = useState('');
  const [resetErr, setResetErr] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const set = k => e => setForm(p=>({...p,[k]:e.target.value}));

  const load = useCallback(() => {
    api.get('/users').then(r => { setUsers(r.data); setLoading(false); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async e => {
    e.preventDefault(); setErr('');
    try { await api.post('/users', form); setModal(false); load(); }
    catch(ex) { setErr(ex.response?.data?.error || 'Error'); }
  };

  const toggle = async (id, is_active) => { await api.patch(`/users/${id}`, { is_active }); load(); };

  const openReset = (u) => { setResetModal(u); setResetPw(''); setResetErr(''); setResetMsg(''); };

  const submitReset = async e => {
    e.preventDefault(); setResetErr(''); setResetMsg('');
    try {
      const r = await api.post(`/users/${resetModal.id}/reset-password`, { password: resetPw });
      setResetMsg(r.data.message);
      setResetPw('');
    } catch(ex) { setResetErr(ex.response?.data?.error || 'Error'); }
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
                  <td>
                    <span className={`badge ${u.role==='admin'?'badge-critical':u.role==='analyst'?'badge-medium':'badge-info'}`}>{u.role}</span>
                  </td>
                  <td className="text-muted">{u.department || '—'}</td>
                  <td className="text-dim">{u.last_login ? format(new Date(u.last_login),'MMM d, HH:mm') : 'Never'}</td>
                  <td>
                    <span className={`status-dot ${u.is_active?'dot-completed':'dot-pending'}`}/>
                    {u.is_active ? 'Active' : 'Disabled'}
                  </td>
                  <td style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    <button className={`btn btn-sm ${u.is_active?'btn-danger':'btn-secondary'}`}
                      onClick={() => toggle(u.id, !u.is_active)}>
                      {u.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button className="btn btn-sm btn-secondary" onClick={() => openReset(u)}>
                      Reset Password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>}
        </div>
      </div>

      {/* Add User Modal */}
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
                  <div className="form-group"><label>Username *</label><input value={form.username} onChange={set('username')} required /></div>
                  <div className="form-group"><label>Email *</label><input type="email" value={form.email} onChange={set('email')} required /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Full Name</label><input value={form.full_name} onChange={set('full_name')} /></div>
                  <div className="form-group"><label>Department</label><input value={form.department} onChange={set('department')} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Role</label>
                    <select value={form.role} onChange={set('role')}>
                      <option value="viewer">Viewer — read-only</option>
                      <option value="analyst">Analyst — can create/edit</option>
                      <option value="auditor">Auditor — read + reports</option>
                      <option value="admin">Admin — full access</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Temporary Password *</label><input type="password" value={form.password} onChange={set('password')} required minLength={12} placeholder="Min 12 characters" /><PasswordStrength password={form.password} /></div>
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

      {/* Reset Password Modal */}
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
                  <input
                    type="password"
                    value={resetPw}
                    onChange={e=>setResetPw(e.target.value)}
                    required
                    minLength={12}
                    placeholder="Min 12 characters"
                    autoFocus
                  />
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
    </div>
  );
}
