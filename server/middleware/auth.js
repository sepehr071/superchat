const jwt = require('jsonwebtoken');
const { db } = require('../config/database');
const config = require('../config');

/**
 * Middleware to authenticate user
 * Verifies JWT token from cookies and attaches user to request
 */
const authenticateUser = (req, res, next) => {
  const token = req.cookies.token;
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Middleware to authenticate admin user
 * First authenticates the user, then checks if they are an admin
 */
const authenticateAdmin = (req, res, next) => {
  authenticateUser(req, res, (err) => {
    if (err) return next(err);
    
    // Check if user is admin
    const userId = req.user.id;
    const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(userId);
    
    if (!user || user.is_admin !== 1) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    next();
  });
};

module.exports = {
  authenticateUser,
  authenticateAdmin
};