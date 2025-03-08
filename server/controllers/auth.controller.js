const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db } = require('../config/database');
const config = require('../config');

/**
 * Register a new user
 */
exports.register = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Check if username already exists
    const existingUser = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Insert new user
    const insertUser = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
    const result = insertUser.run(username, passwordHash);
    
    // Generate JWT token
    const token = jwt.sign(
      { id: result.lastInsertRowid, username },
      config.auth.jwtSecret,
      { expiresIn: config.auth.jwtExpiry }
    );
    
    // Set token in cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: config.auth.cookieMaxAge
    });
    
    res.status(201).json({
      message: 'User registered successfully',
      user: { id: result.lastInsertRowid, username }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
};

/**
 * Login a user
 */
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Special handling for admin login with hardcoded credentials
    if (username === 'god' && password === 'god') {
      // Check if admin user exists
      let user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
      
      if (!user) {
        // Create admin user if it doesn't exist
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        
        const insertAdmin = db.prepare(`
          INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)
        `);
        const result = insertAdmin.run(username, passwordHash);
        
        user = {
          id: result.lastInsertRowid,
          username: username,
          is_admin: 1
        };
      } else {
        // Ensure existing god user has admin privileges
        db.prepare('UPDATE users SET is_admin = 1 WHERE username = ?').run(username);
        user.is_admin = 1;
      }
      
      // Generate JWT token for admin
      const token = jwt.sign(
        { id: user.id, username: user.username, isAdmin: true },
        config.auth.jwtSecret,
        { expiresIn: config.auth.jwtExpiry }
      );
      
      // Set token in cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: config.auth.cookieMaxAge
      });
      
      res.status(200).json({
        message: 'Admin login successful',
        user: { id: user.id, username: user.username, isAdmin: true },
        redirect: '/admin-dashboard.html'
      });
      return;
    }
    
    // Regular user login
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isAdmin = user.is_admin === 1;
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, isAdmin: isAdmin },
      config.auth.jwtSecret,
      { expiresIn: config.auth.jwtExpiry }
    );
    
    // Set token in cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: config.auth.cookieMaxAge
    });
    
    res.status(200).json({
      message: 'Login successful',
      user: { id: user.id, username: user.username, isAdmin: isAdmin },
      redirect: '/dashboard.html'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
};

/**
 * Logout a user
 */
exports.logout = (req, res) => {
  res.clearCookie('token');
  res.status(200).json({ message: 'Logout successful' });
};

/**
 * Get current user information
 */
exports.getCurrentUser = (req, res) => {
  // Get user details including admin status
  const user = db.prepare('SELECT id, username, is_admin FROM users WHERE id = ?').get(req.user.id);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.status(200).json({
    user: {
      id: user.id,
      username: user.username,
      isAdmin: user.is_admin === 1
    }
  });
};