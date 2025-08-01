const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/database');
const router = express.Router();

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  next();
};

// Login page
router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('auth/login', { error: null });
});

// Login POST
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.render('auth/login', { error: 'Invalid email or password' });
    }
    
    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.render('auth/login', { error: 'Invalid email or password' });
    }
    
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };
    
    res.redirect('/');
  } catch (error) {
    console.error('Login error:', error);
    res.render('auth/login', { error: 'An error occurred during login' });
  }
});

// Register page
router.get('/register', (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('auth/register', { error: null });
});

// Register POST
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, confirmPassword, role } = req.body;
    
    if (password !== confirmPassword) {
      return res.render('auth/register', { error: 'Passwords do not match' });
    }
    
    if (password.length < 6) {
      return res.render('auth/register', { error: 'Password must be at least 6 characters long' });
    }
    
    // Check if user already exists
    const existingUser = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.render('auth/register', { error: 'Email already registered' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
                // Insert new user with default 'parent' role
            const result = await db.query(
              'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING *',
              [name, email, hashedPassword, 'parent']
            );
    
    const user = result.rows[0];
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };
    
    res.redirect('/');
  } catch (error) {
    console.error('Registration error:', error);
    res.render('auth/register', { error: 'An error occurred during registration' });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/');
  });
});

module.exports = router; 