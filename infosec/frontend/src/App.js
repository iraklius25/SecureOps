import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Dashboard      from './pages/Dashboard';
import Assets         from './pages/Assets';
import Scans          from './pages/Scans';
import Vulnerabilities from './pages/Vulnerabilities';
import Risks          from './pages/Risks';
import Reports        from './pages/Reports';
import Users          from './pages/Users';
import Groups         from './pages/Groups';
import Login          from './pages/Login';
import AuditLog       from './pages/AuditLog';
import Compliance     from './pages/Compliance';
import ApiKeys        from './pages/ApiKeys';
import Settings       from './pages/Settings';
import Patches        from './pages/Patches';
import ThreatIntel    from './pages/ThreatIntel';
import Topology       from './pages/Topology';
import Approvals             from './pages/Approvals';
import ForceChangePassword   from './pages/ForceChangePassword';
import MaturityAssessment    from './pages/MaturityAssessment';
import './App.css';

export const AuthContext = createContext(null);

const THEMES = [
  { id: 'warm-dark', label: 'Warm Dark',  color: '#2e2720' },
  { id: 'pure-dark', label: 'Pure Dark',  color: '#161b22' },
  { id: 'ocean',     label: 'Ocean',      color: '#0d1830' },
  { id: 'slate',     label: 'Slate',      color: '#222538' },
  { id: 'light',     label: 'Light',      color: '#ffffff' },
];

function useTheme() {
  const [theme, setThemeState] = useState(() => localStorage.getItem('theme') || 'warm-dark');
  const setTheme = t => { setThemeState(t); localStorage.setItem('theme', t); document.documentElement.setAttribute('data-theme', t); };
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  return [theme, setTheme];
}

const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});
api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }
  return Promise.reject(err);
});
export { api };

// ── Two-Factor Auth Modal ─────────────────────────────────────
function TwoFAModal({ onClose }) {
  const { user } = useContext(AuthContext);
  const [step, setStep] = useState('status'); // 'status' | 'setup' | 'disable'
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [is2faEnabled, setIs2faEnabled] = useState(false);

  useEffect(() => {
    api.get('/auth/me').then(r => setIs2faEnabled(r.data.totp_enabled || false)).catch(() => {});
  }, []);

  const startSetup = async () => {
    setLoading(true); setErr('');
    try {
      const r = await api.get('/totp/setup');
      setQr(r.data.qr);
      setSecret(r.data.secret);
      setStep('setup');
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Failed to generate 2FA secret');
    } finally { setLoading(false); }
  };

  const enable = async e => {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      await api.post('/totp/enable', { token: code });
      setMsg('2FA enabled successfully!');
      setIs2faEnabled(true);
      setStep('status');
      setCode('');
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Invalid code, please try again');
    } finally { setLoading(false); }
  };

  const disable = async e => {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      await api.post('/totp/disable', { token: code });
      setMsg('2FA disabled.');
      setIs2faEnabled(false);
      setStep('status');
      setCode('');
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Invalid code');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2>Two-Factor Authentication</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {msg && <div className="alert alert-success" style={{ marginBottom: 14 }}>{msg}</div>}
          {err && <div className="alert alert-error" style={{ marginBottom: 14 }}>{err}</div>}

          {step === 'status' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '12px 16px', background: 'var(--bg3)', borderRadius: 'var(--radius)' }}>
                <span style={{ fontSize: 24 }}>{is2faEnabled ? '🔒' : '🔓'}</span>
                <div>
                  <div style={{ fontWeight: 600 }}>2FA is {is2faEnabled ? 'Enabled' : 'Disabled'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                    {is2faEnabled ? 'Your account is protected with TOTP.' : 'Enable 2FA for extra security.'}
                  </div>
                </div>
              </div>
              {is2faEnabled ? (
                <button className="btn btn-danger" onClick={() => { setStep('disable'); setCode(''); setErr(''); }}>
                  Disable 2FA
                </button>
              ) : (
                <button className="btn btn-primary" onClick={startSetup} disabled={loading}>
                  {loading ? 'Setting up...' : 'Set Up 2FA'}
                </button>
              )}
            </div>
          )}

          {step === 'setup' && (
            <form onSubmit={enable}>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                {qr && <img src={qr} alt="QR Code" style={{ width: 180, height: 180, borderRadius: 8 }} />}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10, textAlign: 'center' }}>
                Scan with your authenticator app (Google Authenticator, Authy, etc.)
              </div>
              <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '8px 12px', marginBottom: 16, fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', textAlign: 'center' }}>
                {secret}
              </div>
              <div className="form-group">
                <label>Enter 6-digit verification code</label>
                <input
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  required
                  maxLength={6}
                  inputMode="numeric"
                  autoFocus
                  style={{ fontFamily: 'monospace', fontSize: 18, letterSpacing: '0.3em', textAlign: 'center' }}
                />
              </div>
              <div className="modal-footer" style={{ padding: 0, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setStep('status'); setErr(''); }}>Back</button>
                <button type="submit" className="btn btn-primary" disabled={loading || code.length !== 6}>
                  {loading ? 'Verifying...' : 'Enable 2FA'}
                </button>
              </div>
            </form>
          )}

          {step === 'disable' && (
            <form onSubmit={disable}>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>
                Enter your current 2FA code to disable two-factor authentication.
              </p>
              <div className="form-group">
                <label>Current 2FA Code</label>
                <input
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  required
                  maxLength={6}
                  inputMode="numeric"
                  autoFocus
                  style={{ fontFamily: 'monospace', fontSize: 18, letterSpacing: '0.3em', textAlign: 'center' }}
                />
              </div>
              <div className="modal-footer" style={{ padding: 0, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setStep('status'); setErr(''); }}>Back</button>
                <button type="submit" className="btn btn-danger" disabled={loading || code.length !== 6}>
                  {loading ? 'Disabling...' : 'Disable 2FA'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Auth Provider ────────────────────────────────────────────
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/auth/me').then(r => setUser(r.data)).catch(() => localStorage.removeItem('token')).finally(() => setLoading(false));
    } else setLoading(false);
  }, []);

  const login = async (username, password) => {
    const r = await api.post('/auth/login', { username, password });
    if (r.data.totp_required) {
      return { totp_required: true, user_id: r.data.user_id };
    }
    localStorage.setItem('token', r.data.token);
    setUser(r.data.user);
    return {};
  };

  const totpLogin = async (user_id, token) => {
    const r = await api.post('/auth/totp-login', { user_id, token });
    localStorage.setItem('token', r.data.token);
    setUser(r.data.user);
  };

  const logout = () => { localStorage.removeItem('token'); setUser(null); };

  if (loading) return <div className="loading-screen"><div className="spinner"/><span>Loading...</span></div>;
  return <AuthContext.Provider value={{ user, setUser, login, totpLogin, logout }}>{children}</AuthContext.Provider>;
}

const NAV = [
  { path: '/',               label: 'Dashboard',       icon: '⬛', roles: ['admin','analyst','viewer','auditor'] },
  { path: '/assets',         label: 'Asset Inventory', icon: '🖥',  roles: ['admin','analyst','viewer','auditor'] },
  { path: '/scans',          label: 'Scans',           icon: '🔍', roles: ['admin','analyst'] },
  { path: '/vulnerabilities', label: 'Vulnerabilities',icon: '⚠',  roles: ['admin','analyst','viewer','auditor'] },
  { path: '/risks',          label: 'Risk Register',   icon: '📋', roles: ['admin','analyst','viewer','auditor'] },
  { path: '/reports',        label: 'Reports',         icon: '📊', roles: ['admin','analyst','auditor'] },
  { path: '/compliance',     label: 'Compliance',      icon: '✅', roles: ['admin','analyst','auditor'] },
  { path: '/maturity',      label: 'Maturity',        icon: '📈', roles: ['admin','analyst','auditor'] },
  { path: '/threat',         label: 'Threat Intel',    icon: '🔥', roles: ['admin','analyst','auditor'] },
  { path: '/patches',        label: 'Patch Tracker',   icon: '🩹', roles: ['admin','analyst','auditor'] },
  { path: '/topology',       label: 'Network Map',     icon: '🗺', roles: ['admin','analyst','auditor','viewer'] },
  { path: '/approvals',      label: 'Approvals',       icon: '🔔', roles: ['admin','analyst'] },
  { path: '/users',          label: 'Users',           icon: '👤', roles: ['admin'] },
  { path: '/groups/users',   label: 'User Groups',     icon: '👥', roles: ['admin','analyst','auditor','viewer'] },
  { path: '/groups/assets',  label: 'Asset Groups',    icon: '🖥', roles: ['admin','analyst','auditor','viewer'] },
  { path: '/audit',          label: 'Audit Log',       icon: '📜', roles: ['admin','auditor'] },
  { path: '/apikeys',        label: 'API Keys',        icon: '🔑', roles: ['admin','analyst'] },
  { path: '/settings',       label: 'Settings',        icon: '⚙️', roles: ['admin'] },
];

function ChangePasswordModal({ onClose }) {
  const [form, setForm] = useState({ current: '', newPassword: '', confirm: '' });
  const [err, setErr]   = useState('');
  const [ok, setOk]     = useState(false);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault(); setErr('');
    if (form.newPassword !== form.confirm) return setErr('New passwords do not match');
    try {
      await api.post('/auth/change-password', { current: form.current, newPassword: form.newPassword });
      setOk(true);
    } catch (ex) { setErr(ex.response?.data?.error || 'Error'); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>Change Password</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {ok ? (
          <div className="modal-body">
            <div className="alert alert-success">Password updated successfully.</div>
            <div className="modal-footer" style={{ padding: '0 0 4px' }}>
              <button className="btn btn-primary" onClick={onClose}>Close</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="modal-body">
              {err && <div className="alert alert-error">{err}</div>}
              <div className="form-group"><label>Current Password</label><input type="password" value={form.current} onChange={set('current')} required /></div>
              <div className="form-group"><label>New Password</label><input type="password" value={form.newPassword} onChange={set('newPassword')} required minLength={8} /></div>
              <div className="form-group"><label>Confirm New Password</label><input type="password" value={form.confirm} onChange={set('confirm')} required minLength={8} /></div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary">Update Password</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function NotificationBell() {
  const [data, setData] = useState({ unread: 0, items: [] });
  const [open, setOpen] = useState(false);
  const [pos,  setPos]  = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const dropRef = useRef(null);

  const load = () => api.get('/notifications').then(r => setData(r.data)).catch(() => {});

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handler = e => {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        dropRef.current && !dropRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, left: r.left });
    }
    setOpen(o => !o);
  };

  const markRead = async id => { await api.patch(`/notifications/${id}/read`).catch(() => {}); load(); };
  const markAllRead = async () => { await api.post('/notifications/read-all').catch(() => {}); load(); };
  const dismiss = async (e, id) => { e.stopPropagation(); await api.delete(`/notifications/${id}`).catch(() => {}); load(); };

  const typeColor = t => ({ critical: 'var(--critical)', warning: 'var(--high)', success: 'var(--low)', info: 'var(--info)' }[t] || 'var(--text2)');

  const dropdown = open && ReactDOM.createPortal(
    <div ref={dropRef} style={{
      position: 'fixed', top: pos.top, left: pos.left, width: 340, maxHeight: 420,
      background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)', zIndex: 99999, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>Notifications</div>
        {data.unread > 0 && (
          <button onClick={markAllRead} style={{ fontSize: 11, color: 'var(--accent-h)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Mark all read
          </button>
        )}
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {data.items.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            No notifications
          </div>
        ) : data.items.map(n => (
          <div key={n.id} onClick={() => markRead(n.id)}
            style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)',
                     background: n.is_read ? 'transparent' : 'rgba(31,111,235,0.06)',
                     cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 4, minWidth: 4, height: '100%', borderRadius: 2,
                           background: n.is_read ? 'transparent' : typeColor(n.type), marginTop: 3 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: n.is_read ? 400 : 600, fontSize: 12, marginBottom: 2 }}>{n.title}</div>
              {n.message && <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.4 }}>{n.message}</div>}
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
                {new Date(n.created_at).toLocaleString()}
              </div>
            </div>
            <button onClick={e => dismiss(e, n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text3)', fontSize: 14, flexShrink: 0 }}>✕</button>
          </div>
        ))}
      </div>
    </div>,
    document.body
  );

  return (
    <>
      <button ref={btnRef} onClick={toggle}
        style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
                 fontSize: 18, color: 'var(--text2)', padding: '4px 6px', borderRadius: 'var(--radius)',
                 transition: 'background 0.15s' }}
        title="Notifications">
        🔔
        {data.unread > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0, background: 'var(--critical)',
            color: '#fff', borderRadius: '50%', width: 16, height: 16,
            fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700
          }}>{data.unread > 9 ? '9+' : data.unread}</span>
        )}
      </button>
      {dropdown}
    </>
  );
}

function Sidebar() {
  const { user, logout } = useContext(AuthContext);
  const loc = useLocation();
  const [changePwd, setChangePwd] = useState(false);
  const [show2fa, setShow2fa] = useState(false);
  const [theme, setTheme] = useTheme();
  const visible = NAV.filter(n => n.roles.includes(user?.role));
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">🛡</div>
        <div><div className="brand-name">SecureOps</div><div className="brand-sub">Risk Platform</div></div>
        <div style={{ marginLeft: 'auto' }}><NotificationBell /></div>
      </div>
      <nav className="sidebar-nav">
        {visible.map(n => (
          <Link key={n.path} to={n.path} className={`nav-item ${loc.pathname === n.path || (n.path !== '/' && loc.pathname.startsWith(n.path)) ? 'active' : ''}`}>
            <span className="nav-icon">{n.icon}</span>{n.label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">{user?.username?.[0]?.toUpperCase()}</div>
          <div><div className="user-name">{user?.username}</div><div className="user-role">{user?.role}</div></div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Theme</div>
          <div style={{ display: 'flex', gap: 5 }}>
            {THEMES.map(t => (
              <button key={t.id} title={t.label} onClick={() => setTheme(t.id)}
                style={{ width: 18, height: 18, borderRadius: '50%', background: t.color, border: theme === t.id ? '2px solid var(--accent-h)' : '2px solid var(--border2)', cursor: 'pointer', padding: 0, flexShrink: 0 }} />
            ))}
          </div>
        </div>
        <button className="logout-btn" onClick={() => setShow2fa(true)} style={{ marginBottom: 6 }}>Setup 2FA</button>
        <button className="logout-btn" onClick={() => setChangePwd(true)} style={{ marginBottom: 6 }}>Change Password</button>
        <button className="logout-btn" onClick={logout}>Sign out</button>
      </div>
      {changePwd && <ChangePasswordModal onClose={() => setChangePwd(false)} />}
      {show2fa && <TwoFAModal onClose={() => setShow2fa(false)} />}
    </aside>
  );
}

function Layout({ children }) {
  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">{children}</main>
    </div>
  );
}

function PrivateRoute({ children, roles }) {
  const { user } = useContext(AuthContext);
  if (!user) return <Navigate to="/login" />;
  if (user.force_password_change) return <Navigate to="/force-change-password" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/force-change-password" element={<ForceChangePassword />} />
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/assets" element={<PrivateRoute><Assets /></PrivateRoute>} />
          <Route path="/scans" element={<PrivateRoute roles={['admin','analyst']}><Scans /></PrivateRoute>} />
          <Route path="/vulnerabilities" element={<PrivateRoute><Vulnerabilities /></PrivateRoute>} />
          <Route path="/risks" element={<PrivateRoute><Risks /></PrivateRoute>} />
          <Route path="/reports" element={<PrivateRoute><Reports /></PrivateRoute>} />
          <Route path="/compliance" element={<PrivateRoute roles={['admin','analyst','auditor']}><Compliance /></PrivateRoute>} />
          <Route path="/maturity"   element={<PrivateRoute roles={['admin','analyst','auditor']}><MaturityAssessment /></PrivateRoute>} />
          <Route path="/threat" element={<PrivateRoute roles={['admin','analyst','auditor']}><ThreatIntel /></PrivateRoute>} />
          <Route path="/patches" element={<PrivateRoute roles={['admin','analyst','auditor']}><Patches /></PrivateRoute>} />
          <Route path="/topology" element={<PrivateRoute><Topology /></PrivateRoute>} />
          <Route path="/approvals" element={<PrivateRoute roles={['admin','analyst']}><Approvals /></PrivateRoute>} />
          <Route path="/users" element={<PrivateRoute roles={['admin']}><Users /></PrivateRoute>} />
          <Route path="/groups/users"  element={<PrivateRoute><Groups defaultTab="users"  /></PrivateRoute>} />
          <Route path="/groups/assets" element={<PrivateRoute><Groups defaultTab="assets" /></PrivateRoute>} />
          <Route path="/audit" element={<PrivateRoute roles={['admin','auditor']}><AuditLog /></PrivateRoute>} />
          <Route path="/apikeys" element={<PrivateRoute roles={['admin','analyst']}><ApiKeys /></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute roles={['admin']}><Settings /></PrivateRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
