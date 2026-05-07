// users.js
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { validatePassword } = require('../utils/passwordPolicy');

router.get('/', auth, requireRole('admin'), async (req, res) => {
  const r = await db.query('SELECT id,username,email,full_name,role,department,is_active,last_login,created_at FROM users ORDER BY created_at DESC');
  res.json(r.rows);
});

router.post('/', auth, requireRole('admin'), async (req, res) => {
  const { username, email, password, full_name, role, department } = req.body;
  if (!username||!email||!password) return res.status(400).json({ error: 'username, email, password required' });
  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });
  try {
    const hash = await bcrypt.hash(password, 12);
    const r = await db.query(
      'INSERT INTO users (username,email,password,full_name,role,department,force_password_change) VALUES ($1,$2,$3,$4,$5,$6,TRUE) RETURNING id,username,email,role',
      [username,email,hash,full_name,role||'analyst',department]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code==='23505') return res.status(409).json({ error: 'Username or email taken' });
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/reset-password', auth, requireRole('admin'), async (req, res) => {
  const { password } = req.body;
  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });
  try {
    const hash = await bcrypt.hash(password, 12);
    await db.query(
      'UPDATE users SET password=$1, force_password_change=TRUE WHERE id=$2',
      [hash, req.params.id]
    );
    res.json({ message: 'Password reset — user will be prompted to change on next login' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id', auth, requireRole('admin'), async (req, res) => {
  const { role, is_active, department } = req.body;
  try {
    const r = await db.query(
      'UPDATE users SET role=COALESCE($2,role), is_active=COALESCE($3,is_active), department=COALESCE($4,department) WHERE id=$1 RETURNING id,username,role,is_active',
      [req.params.id, role, is_active, department]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
