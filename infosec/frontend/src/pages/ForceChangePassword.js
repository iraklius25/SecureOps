import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, AuthContext } from '../App';

export default function ForceChangePassword() {
  const { user, setUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [form, setForm] = useState({ current: '', newPassword: '', confirm: '' });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState({ current: false, newPassword: false, confirm: false });
  const toggleShow = k => () => setShow(p => ({ ...p, [k]: !p[k] }));
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setErr('');
    if (form.newPassword.length < 8) return setErr('New password must be at least 8 characters');
    if (form.newPassword === form.current) return setErr('New password must be different from the current password');
    if (form.newPassword !== form.confirm) return setErr('Passwords do not match');
    setLoading(true);
    try {
      await api.post('/auth/change-password', { current: form.current, newPassword: form.newPassword });
      const me = await api.get('/auth/me');
      setUser(me.data);
      navigate('/');
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg1)', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 420, background: 'var(--bg2)',
        borderRadius: 'var(--radius-lg)', border: '1px solid var(--border2)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
          background: 'rgba(220,53,69,0.08)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 24 }}>🔐</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--critical)' }}>Password Change Required</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
              You must set a new password before you can continue.
            </div>
          </div>
        </div>

        <form onSubmit={submit} style={{ padding: 24 }}>
          <div style={{
            background: 'rgba(220,53,69,0.07)', border: '1px solid rgba(220,53,69,0.25)',
            borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 20,
            fontSize: 13, color: 'var(--text2)', lineHeight: 1.5,
          }}>
            You are logged in with the default administrator password. For security, you must
            change it now. You cannot access the platform until this is done.
          </div>

          {err && <div className="alert alert-error" style={{ marginBottom: 16 }}>{err}</div>}

          {[
            { key: 'current', label: 'Current Password', placeholder: 'Enter current password', autoFocus: true },
            { key: 'newPassword', label: 'New Password', sublabel: '(min 8 characters)', placeholder: 'Enter new password', minLength: 8 },
            { key: 'confirm', label: 'Confirm New Password', placeholder: 'Repeat new password', minLength: 8 },
          ].map(({ key, label, sublabel, placeholder, autoFocus, minLength }) => (
            <div className="form-group" key={key}>
              <label>{label} {sublabel && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{sublabel}</span>}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={show[key] ? 'text' : 'password'}
                  value={form[key]}
                  onChange={set(key)}
                  placeholder={placeholder}
                  required
                  autoFocus={autoFocus}
                  minLength={minLength}
                  style={{ paddingRight: 40, width: '100%', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={toggleShow(key)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 0, fontSize: 16, lineHeight: 1 }}
                  tabIndex={-1}
                >
                  {show[key] ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
          ))}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? 'Updating...' : 'Set New Password & Continue'}
          </button>

          <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>
            Logged in as <strong>{user?.username}</strong> — <span
              style={{ cursor: 'pointer', color: 'var(--accent-h)' }}
              onClick={() => { localStorage.removeItem('token'); window.location.href = '/login'; }}
            >sign out</span>
          </div>
        </form>
      </div>
    </div>
  );
}
