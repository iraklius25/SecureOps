const jwt = require('jsonwebtoken');
const db  = require('../db');

const auth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await db.query('SELECT id, username, email, role, is_active FROM users WHERE id=$1', [payload.id]);
    if (!user.rows.length || !user.rows[0].is_active)
      return res.status(401).json({ error: 'User not found or inactive' });
    req.user = user.rows[0];
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).json({ error: 'Insufficient permissions' });
  next();
};

module.exports = { auth, requireRole };
