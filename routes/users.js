const express = require('express');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const db = require('../config/database');
const router = express.Router();

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  next();
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).render('error', { message: 'Access denied. Admin only.' });
  }
  next();
};

// Configure nodemailer (you'll need to set up your email credentials)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

// View all users (admin only)
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { role, search } = req.query;
    let query = 'SELECT * FROM users WHERE 1=1';
    const params = [];
    let paramCount = 0;
    
    if (role && role !== 'all') {
      paramCount++;
      query += ` AND role = $${paramCount}`;
      params.push(role);
    }
    
    if (search) {
      paramCount++;
      query += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await db.query(query, params);
    
    // Get user statistics
    const statsResult = await db.query(`
      SELECT 
        role,
        COUNT(*) as count
      FROM users 
      GROUP BY role
    `);
    
    const stats = {};
    statsResult.rows.forEach(row => {
      stats[row.role] = row.count;
    });
    
    res.render('users/index', { 
      users: result.rows,
      stats: stats,
      user: req.session.user,
      filters: { role, search }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.render('users/index', { 
      users: [],
      stats: {},
      user: req.session.user,
      filters: {},
      error: 'Error loading users'
    });
  }
});

// Create new user form (admin only)
router.get('/new', requireAuth, requireAdmin, (req, res) => {
  res.render('users/new', { 
    user: req.session.user,
    error: null
  });
});

// Create new user (admin only)
router.post('/new', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    
    if (!name || !email || !password || !role) {
      return res.render('users/new', { 
        user: req.session.user,
        error: 'All fields are required'
      });
    }
    
    if (password.length < 6) {
      return res.render('users/new', { 
        user: req.session.user,
        error: 'Password must be at least 6 characters long'
      });
    }
    
    // Check if user already exists
    const existingUser = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.render('users/new', { 
        user: req.session.user,
        error: 'Email already registered'
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert new user
    const result = await db.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, hashedPassword, role]
    );
    
    const newUser = result.rows[0];
    
    // Send welcome email
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER || 'your-email@gmail.com',
        to: email,
        subject: 'Welcome to Parent-School Hub',
        html: `
          <h2>Welcome to Parent-School Hub!</h2>
          <p>Hello ${name},</p>
          <p>Your account has been created successfully with the role: <strong>${role}</strong></p>
          <p>You can now log in to the system using your email and password.</p>
          <p>Best regards,<br>School Administration</p>
        `
      });
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
    }
    
    res.redirect('/users?success=User created successfully');
  } catch (error) {
    console.error('Error creating user:', error);
    res.render('users/new', { 
      user: req.session.user,
      error: 'An error occurred while creating the user'
    });
  }
});

// Edit user form (admin only)
router.get('/edit/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).render('error', { message: 'User not found' });
    }
    
    res.render('users/edit', { 
      userToEdit: result.rows[0],
      user: req.session.user,
      error: null
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).render('error', { message: 'Error loading user' });
  }
});

// Update user (admin only)
router.post('/edit/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, email, role, password } = req.body;
    
    if (!name || !email || !role) {
      return res.render('users/edit', { 
        userToEdit: { id: userId, name, email, role },
        user: req.session.user,
        error: 'Name, email, and role are required'
      });
    }
    
    // Check if email is already taken by another user
    const existingUser = await db.query('SELECT * FROM users WHERE email = $1 AND id != $2', [email, userId]);
    if (existingUser.rows.length > 0) {
      return res.render('users/edit', { 
        userToEdit: { id: userId, name, email, role },
        user: req.session.user,
        error: 'Email already taken by another user'
      });
    }
    
    let query, params;
    
    if (password && password.length >= 6) {
      // Update with new password
      const hashedPassword = await bcrypt.hash(password, 10);
      query = 'UPDATE users SET name = $1, email = $2, role = $3, password = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5';
      params = [name, email, role, hashedPassword, userId];
    } else {
      // Update without password
      query = 'UPDATE users SET name = $1, email = $2, role = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4';
      params = [name, email, role, userId];
    }
    
    await db.query(query, params);
    
    res.redirect('/users?success=User updated successfully');
  } catch (error) {
    console.error('Error updating user:', error);
    res.render('users/edit', { 
      userToEdit: { id: req.params.id, name: req.body.name, email: req.body.email, role: req.body.role },
      user: req.session.user,
      error: 'An error occurred while updating the user'
    });
  }
});

// Delete user (admin only)
router.post('/delete/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Prevent admin from deleting themselves
    if (parseInt(userId) === req.session.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    // Check if user exists
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Delete user (cascade will handle related data)
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    
    res.redirect('/users?success=User deleted successfully');
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Error deleting user' });
  }
});

// Send email to users (admin only)
router.get('/email', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { role } = req.query;
    let query = 'SELECT id, name, email, role FROM users WHERE 1=1';
    const params = [];
    
    if (role && role !== 'all') {
      query += ' AND role = $1';
      params.push(role);
    }
    
    query += ' ORDER BY name';
    
    const result = await db.query(query, params);
    
    res.render('users/email', { 
      users: result.rows,
      user: req.session.user,
      error: null
    });
  } catch (error) {
    console.error('Error loading users for email:', error);
    res.render('users/email', { 
      users: [],
      user: req.session.user,
      error: 'Error loading users'
    });
  }
});

// Send email to users (admin only)
router.post('/email', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { recipients, subject, message } = req.body;
    
    if (!recipients || !subject || !message) {
      return res.render('users/email', { 
        users: [],
        user: req.session.user,
        error: 'All fields are required'
      });
    }
    
    // Get selected users
    const usersResult = await db.query('SELECT * FROM users WHERE id = ANY($1)', [recipients]);
    
    // Send emails
    const emailPromises = usersResult.rows.map(async (user) => {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER || 'your-email@gmail.com',
          to: user.email,
          subject: subject,
          html: `
            <h2>${subject}</h2>
            <p>Hello ${user.name},</p>
            <div>${message}</div>
            <p>Best regards,<br>School Administration</p>
          `
        });
        
        // Log email notification
        await db.query(`
          INSERT INTO email_notifications (user_id, subject, message, is_sent, sent_at) 
          VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP)
        `, [user.id, subject, message]);
        
        return { success: true, user: user.email };
      } catch (emailError) {
        console.error(`Error sending email to ${user.email}:`, emailError);
        
        // Log failed email notification
        await db.query(`
          INSERT INTO email_notifications (user_id, subject, message, is_sent) 
          VALUES ($1, $2, $3, false)
        `, [user.id, subject, message]);
        
        return { success: false, user: user.email, error: emailError.message };
      }
    });
    
    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    res.redirect(`/users/email?success=${successCount} emails sent successfully${failureCount > 0 ? `, ${failureCount} failed` : ''}`);
  } catch (error) {
    console.error('Error sending emails:', error);
    res.render('users/email', { 
      users: [],
      user: req.session.user,
      error: 'An error occurred while sending emails'
    });
  }
});

// View user details (admin only)
router.get('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).render('error', { message: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Get user's posts
    const postsResult = await db.query('SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    
    // Get user's comments
    const commentsResult = await db.query('SELECT * FROM comments WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    
    // Get user's messages
    const messagesResult = await db.query(`
      SELECT dm.*, u.name as other_user_name 
      FROM direct_messages dm
      JOIN users u ON (dm.sender_id = u.id OR dm.receiver_id = u.id)
      WHERE (dm.sender_id = $1 OR dm.receiver_id = $1) AND u.id != $1
      ORDER BY dm.created_at DESC
      LIMIT 10
    `, [userId]);
    
    res.render('users/show', { 
      userToShow: user,
      posts: postsResult.rows,
      comments: commentsResult.rows,
      messages: messagesResult.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).render('error', { message: 'Error loading user details' });
  }
});

module.exports = router; 