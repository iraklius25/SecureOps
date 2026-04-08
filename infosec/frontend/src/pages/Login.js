import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../App';

export default function Login() {
  const { login, user } = useContext(AuthContext);
  const nav = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) { nav('/'); return null; }

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(form.username, form.password);
      nav('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="icon">🛡️</div>
          <h1>SecureOps</h1>
          <p>InfoSec Risk Management Platform</p>
        </div>
        {error && <div className="login-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Username or email</label>
            <input value={form.username} onChange={e => setForm(p=>({...p,username:e.target.value}))} required autoFocus placeholder="admin" />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={form.password} onChange={e => setForm(p=>({...p,password:e.target.value}))} required placeholder="••••••••" />
          </div>
          <button type="submit" className="btn btn-primary" style={{width:'100%',justifyContent:'center',marginTop:8}} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p style={{textAlign:'center',fontSize:11,color:'var(--text3)',marginTop:16}}>
          Default: admin / Admin@123! — change after first login
        </p>
      </div>
    </div>
  );
}
