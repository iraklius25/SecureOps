const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const db     = require('../db');
const { auth } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  try {
    const user = await db.query(
      'SELECT * FROM users WHERE username=$1 OR email=$1',
      [username]
    );
    if (!user.rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const u = user.rows[0];
    if (!u.is_active) return res.status(403).json({ error: 'Account disabled' });
    const valid = await bcrypt.compare(password, u.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    // If 2FA is enabled, don't issue JWT yet — require TOTP step
    if (u.totp_enabled) {
      return res.json({ totp_required: true, user_id: u.id });
    }

    await db.query('UPDATE users SET last_login=NOW() WHERE id=$1', [u.id]);
    const token = jwt.sign({ id: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, user: { id: u.id, username: u.username, email: u.email, role: u.role, full_name: u.full_name, force_password_change: u.force_password_change } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/auth/totp-login — complete 2FA login
router.post('/totp-login', async (req, res) => {
  const { user_id, token } = req.body;
  if (!user_id || !token) return res.status(400).json({ error: 'user_id and token are required' });
  try {
    const userResult = await db.query(
      'SELECT id, username, email, role, full_name, totp_secret, totp_enabled, is_active FROM users WHERE id=$1',
      [user_id]
    );
    if (!userResult.rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const u = userResult.rows[0];
    if (!u.is_active) return res.status(403).json({ error: 'Account disabled' });
    if (!u.totp_enabled || !u.totp_secret) {
      return res.status(400).json({ error: '2FA is not configured for this user' });
    }

    const valid = speakeasy.totp.verify({
      secret: u.totp_secret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!valid) return res.status(401).json({ error: 'Invalid 2FA code' });

    await db.query('UPDATE users SET last_login=NOW() WHERE id=$1', [u.id]);
    const jwtToken = jwt.sign({ id: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '12h' });
    res.json({ token: jwtToken, user: { id: u.id, username: u.username, email: u.email, role: u.role, full_name: u.full_name, force_password_change: u.force_password_change } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/auth/me
router.get('/me', auth, (req, res) => res.json(req.user));

// POST /api/auth/change-password
router.post('/change-password', auth, async (req, res) => {
  const { current, newPassword } = req.body;
  if (!current || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be 8+ characters' });
  try {
    const user = await db.query('SELECT password FROM users WHERE id=$1', [req.user.id]);
    const valid = await bcrypt.compare(current, user.rows[0].password);
    if (!valid) return res.status(401).json({ error: 'Current password incorrect' });
    const hashed = await bcrypt.hash(newPassword, 12);
    await db.query(
      'UPDATE users SET password=$1, force_password_change=FALSE, updated_at=NOW() WHERE id=$2',
      [hashed, req.user.id]
    );
    res.json({ message: 'Password updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
