const jwt = require('jsonwebtoken');
const db  = require('../db');

const auth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const user = await db.query(
      'SELECT id, username, email, role, is_active, force_password_change FROM users WHERE id=$1',
      [payload.id]
    );
    if (!user.rows.length || !user.rows[0].is_active)
      return res.status(401).json({ error: 'User not found or inactive' });
    req.user = user.rows[0];

    const path = req.originalUrl.split('?')[0];
    const allowed = ['/api/auth/change-password', '/api/auth/me'];
    if (req.user.force_password_change && !allowed.includes(path)) {
      return res.status(403).json({ error: 'Password change required', force_password_change: true });
    }

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
