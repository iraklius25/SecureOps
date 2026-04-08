import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Dashboard from './pages/Dashboard';
import Assets from './pages/Assets';
import Scans from './pages/Scans';
import Vulnerabilities from './pages/Vulnerabilities';
import Risks from './pages/Risks';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Groups from './pages/Groups';
import Login from './pages/Login';
import './App.css';

export const AuthContext = createContext(null);

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
    localStorage.setItem('token', r.data.token);
    setUser(r.data.user);
  };
  const logout = () => { localStorage.removeItem('token'); setUser(null); };

  if (loading) return <div className="loading-screen"><div className="spinner"/><span>Loading...</span></div>;
  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

const NAV = [
  { path: '/',              label: 'Dashboard',       icon: '⬛', roles: ['admin','analyst','viewer','auditor'] },
  { path: '/assets',        label: 'Asset Inventory', icon: '🖥',  roles: ['admin','analyst','viewer','auditor'] },
  { path: '/scans',         label: 'Scans',           icon: '🔍', roles: ['admin','analyst'] },
  { path: '/vulnerabilities',label: 'Vulnerabilities',icon: '⚠',  roles: ['admin','analyst','viewer','auditor'] },
  { path: '/risks',         label: 'Risk Register',   icon: '📋', roles: ['admin','analyst','viewer','auditor'] },
  { path: '/reports',       label: 'Reports',         icon: '📊', roles: ['admin','analyst','auditor'] },
  { path: '/users',         label: 'Users',           icon: '👤', roles: ['admin'] },
  { path: '/groups',        label: 'Groups',          icon: '👥', roles: ['admin','analyst','auditor','viewer'] },
];

function Sidebar() {
  const { user, logout } = useContext(AuthContext);
  const loc = useLocation();
  const visible = NAV.filter(n => n.roles.includes(user?.role));
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">🛡</div>
        <div><div className="brand-name">SecureOps</div><div className="brand-sub">Risk Platform</div></div>
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
        <button className="logout-btn" onClick={logout}>Sign out</button>
      </div>
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
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/assets" element={<PrivateRoute><Assets /></PrivateRoute>} />
          <Route path="/scans" element={<PrivateRoute roles={['admin','analyst']}><Scans /></PrivateRoute>} />
          <Route path="/vulnerabilities" element={<PrivateRoute><Vulnerabilities /></PrivateRoute>} />
          <Route path="/risks" element={<PrivateRoute><Risks /></PrivateRoute>} />
          <Route path="/reports" element={<PrivateRoute><Reports /></PrivateRoute>} />
          <Route path="/users" element={<PrivateRoute roles={['admin']}><Users /></PrivateRoute>} />
          <Route path="/groups" element={<PrivateRoute><Groups /></PrivateRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
