import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext, api } from '../App';

export default function Login() {
  const { login, totpLogin, user } = useContext(AuthContext);
  const nav = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState(null);

  // 2FA step state
  const [totpRequired, setTotpRequired] = useState(false);
  const [userId, setUserId] = useState(null);
  const [otpCode, setOtpCode] = useState('');

  useEffect(() => {
    api.get('/settings/logo', { responseType: 'blob' })
      .then(r => setLogoUrl(URL.createObjectURL(r.data)))
      .catch(() => {});
  }, []);

  if (user) { nav('/'); return null; }

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const result = await login(form.username, form.password);
      if (result?.totp_required) {
        setTotpRequired(true);
        setUserId(result.user_id);
      } else {
        nav('/');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally { setLoading(false); }
  };

  const submitOtp = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await totpLogin(userId, otpCode);
      nav('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid 2FA code');
      setOtpCode('');
    } finally { setLoading(false); }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          {logoUrl ? (
            <img src={logoUrl} alt="Organization logo" style={{ maxHeight: 80, maxWidth: 220, marginBottom: 12, objectFit: 'contain' }} />
          ) : (
            <div className="icon">🛡️</div>
          )}
          <h1>SecureOps</h1>
          <p>InfoSec Risk Management Platform</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        {!totpRequired ? (
          <form onSubmit={submit}>
            <div className="form-group">
              <label>Username or email</label>
              <input
                value={form.username}
                onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                required
                autoFocus
                placeholder="admin"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                required
                placeholder="••••••••"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitOtp}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔐</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Two-Factor Authentication</div>
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>
                Enter the 6-digit code from your authenticator app
              </div>
            </div>
            <div className="form-group">
              <label>Authentication Code</label>
              <input
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                required
                maxLength={6}
                inputMode="numeric"
                autoFocus
                disabled={loading}
                style={{ fontFamily: 'monospace', fontSize: 20, letterSpacing: '0.4em', textAlign: 'center' }}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
              disabled={loading || otpCode.length !== 6}
            >
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
              onClick={() => { setTotpRequired(false); setUserId(null); setOtpCode(''); setError(''); }}
            >
              Back to Login
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text3)', marginTop: 16 }}>
          Default: admin / Admin@123! — change after first login
        </p>
      </div>
    </div>
  );
}
