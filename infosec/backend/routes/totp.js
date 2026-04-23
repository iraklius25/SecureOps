const router = require('express').Router();
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { auth } = require('../middleware/auth');

// GET /api/totp/setup — generate TOTP secret
router.get('/setup', auth, async (req, res) => {
  try {
    const userResult = await db.query('SELECT username FROM users WHERE id=$1', [req.user.id]);
    if (!userResult.rows.length) return res.status(404).json({ error: 'User not found' });
    const username = userResult.rows[0].username;

    const secret = speakeasy.generateSecret({
      name: `SecureOps (${username})`,
      length: 20,
    });

    // Store the secret (not yet enabled)
    await db.query('UPDATE users SET totp_secret=$1 WHERE id=$2', [secret.base32, req.user.id]);

    const qr = await QRCode.toDataURL(secret.otpauth_url);

    res.json({
      secret: secret.base32,
      qr,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/totp/enable — verify token and enable 2FA
router.post('/enable', auth, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token is required' });
  try {
    const userResult = await db.query('SELECT totp_secret FROM users WHERE id=$1', [req.user.id]);
    if (!userResult.rows.length) return res.status(404).json({ error: 'User not found' });
    const { totp_secret } = userResult.rows[0];
    if (!totp_secret) return res.status(400).json({ error: 'No TOTP secret found. Call /setup first.' });

    const valid = speakeasy.totp.verify({
      secret: totp_secret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!valid) return res.status(401).json({ error: 'Invalid TOTP token' });

    await db.query('UPDATE users SET totp_enabled=TRUE WHERE id=$1', [req.user.id]);
    res.json({ message: '2FA enabled successfully' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/totp/disable — verify token and disable 2FA
router.post('/disable', auth, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token is required' });
  try {
    const userResult = await db.query('SELECT totp_secret, totp_enabled FROM users WHERE id=$1', [req.user.id]);
    if (!userResult.rows.length) return res.status(404).json({ error: 'User not found' });
    const { totp_secret, totp_enabled } = userResult.rows[0];
    if (!totp_enabled) return res.status(400).json({ error: '2FA is not enabled' });

    const valid = speakeasy.totp.verify({
      secret: totp_secret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!valid) return res.status(401).json({ error: 'Invalid TOTP token' });

    await db.query('UPDATE users SET totp_enabled=FALSE, totp_secret=NULL WHERE id=$1', [req.user.id]);
    res.json({ message: '2FA disabled successfully' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/totp/login — public route: verify TOTP and return JWT
router.post('/login', async (req, res) => {
  const { user_id, token } = req.body;
  if (!user_id || !token) return res.status(400).json({ error: 'user_id and token are required' });
  try {
    const userResult = await db.query(
      'SELECT id, username, email, role, full_name, totp_secret, totp_enabled, is_active FROM users WHERE id=$1',
      [user_id]
    );
    if (!userResult.rows.length) return res.status(401).json({ error: 'Invalid user' });
    const u = userResult.rows[0];
    if (!u.is_active) return res.status(403).json({ error: 'Account disabled' });
    if (!u.totp_enabled || !u.totp_secret) {
      return res.status(400).json({ error: '2FA is not enabled for this user' });
    }

    const valid = speakeasy.totp.verify({
      secret: u.totp_secret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!valid) return res.status(401).json({ valid: false, error: 'Invalid TOTP token' });

    await db.query('UPDATE users SET last_login=NOW() WHERE id=$1', [u.id]);
    const jwtToken = jwt.sign({ id: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '12h' });

    res.json({
      valid: true,
      token: jwtToken,
      user: { id: u.id, username: u.username, email: u.email, role: u.role, full_name: u.full_name },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
