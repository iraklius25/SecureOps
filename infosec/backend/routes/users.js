const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { validatePassword } = require('../utils/passwordPolicy');
const auditLog = require('../services/auditLog');

const VALID_ROLES = ['admin', 'analyst', 'auditor', 'viewer'];

router.get('/', auth, requireRole('admin'), async (req, res) => {
  try {
    const r = await db.query('SELECT id,username,email,full_name,role,department,is_active,last_login,created_at FROM users ORDER BY created_at DESC');
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', auth, requireRole('admin'), async (req, res) => {
  const { username, email, password, full_name, role, department } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'username, email, password required' });
  if (username.length > 50 || email.length > 100) return res.status(400).json({ error: 'Input too long' });
  if (role && !VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });
  try {
    const hash = await bcrypt.hash(password, 12);
    const r = await db.query(
      'INSERT INTO users (username,email,password,full_name,role,department,force_password_change) VALUES ($1,$2,$3,$4,$5,$6,TRUE) RETURNING id,username,email,role',
      [username, email, hash, full_name || null, role || 'analyst', department || null]
    );
    auditLog.log(req, 'CREATE', 'user', r.rows[0].id, username, null, { username, email, role: role || 'analyst' });
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Username or email already taken' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', auth, requireRole('admin'), async (req, res) => {
  const { role, is_active, department, full_name, email } = req.body;
  if (role && !VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (email && email.length > 100) return res.status(400).json({ error: 'Email too long' });
  try {
    const before = await db.query(
      'SELECT id,username,role,is_active,department,full_name,email FROM users WHERE id=$1',
      [req.params.id]
    );
    if (!before.rows.length) return res.status(404).json({ error: 'User not found' });

    // Prevent removing the last admin
    if (role && role !== 'admin' && before.rows[0].role === 'admin') {
      const adminCount = await db.query("SELECT COUNT(*) FROM users WHERE role='admin'");
      if (parseInt(adminCount.rows[0].count) <= 1)
        return res.status(400).json({ error: 'Cannot demote the last admin account' });
    }

    const r = await db.query(
      `UPDATE users SET
        role        = COALESCE($2, role),
        is_active   = COALESCE($3, is_active),
        department  = COALESCE($4, department),
        full_name   = COALESCE($5, full_name),
        email       = COALESCE($6, email),
        updated_at  = NOW()
       WHERE id=$1
       RETURNING id,username,role,is_active,department,full_name,email`,
      [req.params.id, role ?? null, is_active ?? null, department ?? null, full_name ?? null, email ?? null]
    );
    auditLog.log(req, 'UPDATE', 'user', req.params.id, before.rows[0].username, before.rows[0], r.rows[0]);
    res.json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already taken' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  if (req.params.id === String(req.user.id))
    return res.status(400).json({ error: 'You cannot delete your own account' });
  try {
    const target = await db.query('SELECT id,username,role FROM users WHERE id=$1', [req.params.id]);
    if (!target.rows.length) return res.status(404).json({ error: 'User not found' });

    if (target.rows[0].role === 'admin') {
      const adminCount = await db.query("SELECT COUNT(*) FROM users WHERE role='admin'");
      if (parseInt(adminCount.rows[0].count) <= 1)
        return res.status(400).json({ error: 'Cannot delete the last admin account' });
    }

    await db.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    auditLog.log(req, 'DELETE', 'user', req.params.id, target.rows[0].username, target.rows[0], null);
    res.json({ message: 'User deleted' });
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/:id/reset-password', auth, requireRole('admin'), async (req, res) => {
  const { password } = req.body;
  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });
  try {
    const target = await db.query('SELECT username FROM users WHERE id=$1', [req.params.id]);
    if (!target.rows.length) return res.status(404).json({ error: 'User not found' });
    const hash = await bcrypt.hash(password, 12);
    await db.query('UPDATE users SET password=$1, force_password_change=TRUE WHERE id=$2', [hash, req.params.id]);
    auditLog.log(req, 'RESET_PASSWORD', 'user', req.params.id, target.rows[0].username, null, null);
    res.json({ message: 'Password reset — user will be prompted to change on next login' });
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
