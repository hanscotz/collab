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
  
  // Check for session timeout message
  const message = req.query.message;
  res.render('auth/login', { error: null, message: message });
});

// Login POST
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.render('auth/login', { error: 'Invalid email or password', message: null });
    }
    
    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.render('auth/login', { error: 'Invalid email or password', message: null });
    }
    
    // Check if parent account is approved
    if (user.role === 'parent' && !user.is_approved) {
      return res.render('auth/login', { 
        error: 'Your account is pending admin approval. Please contact the school administration.',
        message: null
      });
    }
    
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      is_approved: user.is_approved
    };
    
    res.redirect('/');
  } catch (error) {
    console.error('Login error:', error);
    res.render('auth/login', { error: 'An error occurred during login', message: null });
  }
});

// Register page
router.get('/register', (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('auth/register', { error: null, message: null });
});

// Register POST
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;
    
    if (password !== confirmPassword) {
      return res.render('auth/register', { error: 'Passwords do not match', message: null });
    }
    
    if (password.length < 6) {
      return res.render('auth/register', { error: 'Password must be at least 6 characters long', message: null });
    }
    
    // Check if user already exists
    const existingUser = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.render('auth/register', { error: 'Email already registered', message: null });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert new user with default 'parent' role and unapproved status
    const result = await db.query(
      'INSERT INTO users (name, email, password, role, is_approved) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, email, hashedPassword, 'parent', false]
    );
    
    const user = result.rows[0];
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      is_approved: user.is_approved
    };
    
    // Redirect to pending approval page for new parents
    res.redirect('/auth/pending-approval');
  } catch (error) {
    console.error('Registration error:', error);
    res.render('auth/register', { error: 'An error occurred during registration', message: null });
  }
});

// Pending approval page for unapproved parents
router.get('/pending-approval', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'parent' || req.session.user.is_approved) {
    return res.redirect('/');
  }
  res.render('auth/pending-approval', { user: req.session.user });
});

// Logout
router.get('/logout', (req, res) => {
  // Store user info for logging before destroying session
  const userInfo = req.session.user ? `${req.session.user.name} (${req.session.user.email})` : 'Unknown user';
  
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).render('error', { message: 'Error during logout' });
    }
    
    // Log successful logout
    console.log(`User logged out successfully: ${userInfo}`);
    
    // Clear any cookies and redirect to home page
    res.clearCookie('connect.sid');
    res.redirect('/?message=You have been logged out successfully');
  });
});

// Logout POST (for additional security)
router.post('/logout', (req, res) => {
  // Store user info for logging before destroying session
  const userInfo = req.session.user ? `${req.session.user.name} (${req.session.user.email})` : 'Unknown user';
  
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Error during logout' });
    }
    
    // Log successful logout
    console.log(`User logged out successfully: ${userInfo}`);
    
    // Clear any cookies and redirect to home page
    res.clearCookie('connect.sid');
    res.redirect('/?message=You have been logged out successfully');
  });
});

module.exports = router; 