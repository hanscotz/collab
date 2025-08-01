const express = require('express');
const db = require('../config/database');
const router = express.Router();

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  next();
};

// Middleware to check if user is staff (teacher or admin)
const requireStaff = (req, res, next) => {
  if (!req.session.user || (req.session.user.role !== 'teacher' && req.session.user.role !== 'admin')) {
    return res.status(403).render('error', { message: 'Access denied. Staff only.' });
  }
  next();
};

// Contact form page
router.get('/', (req, res) => {
  res.render('contact/index', { 
    user: req.session.user,
    success: req.query.success,
    error: req.query.error
  });
});

// Submit contact message
router.post('/', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    
    if (!name || !email || !subject || !message) {
      return res.redirect('/contact?error=All fields are required');
    }
    
    await db.query(
      'INSERT INTO contact_messages (name, email, subject, message) VALUES ($1, $2, $3, $4)',
      [name, email, subject, message]
    );
    
    res.redirect('/contact?success=Message sent successfully! We will get back to you soon.');
  } catch (error) {
    console.error('Error sending contact message:', error);
    res.redirect('/contact?error=Error sending message. Please try again.');
  }
});

// View all contact messages (staff only)
router.get('/messages', requireAuth, requireStaff, async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM contact_messages';
    const params = [];
    
    if (status && status !== 'all') {
      query += ' WHERE status = $1';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await db.query(query, params);
    res.render('contact/messages', { 
      messages: result.rows,
      user: req.session.user,
      currentStatus: status || 'all'
    });
  } catch (error) {
    console.error('Error fetching contact messages:', error);
    res.render('contact/messages', { 
      messages: [],
      user: req.session.user,
      currentStatus: 'all'
    });
  }
});

// View single contact message (staff only)
router.get('/messages/:id', requireAuth, requireStaff, async (req, res) => {
  try {
    const messageId = req.params.id;
    const result = await db.query('SELECT * FROM contact_messages WHERE id = $1', [messageId]);
    
    if (result.rows.length === 0) {
      return res.status(404).render('error', { message: 'Message not found' });
    }
    
    const message = result.rows[0];
    
    // Mark as read if unread
    if (message.status === 'unread') {
      await db.query('UPDATE contact_messages SET status = $1 WHERE id = $2', ['read', messageId]);
      message.status = 'read';
    }
    
    res.render('contact/message-detail', { message, user: req.session.user });
  } catch (error) {
    console.error('Error fetching contact message:', error);
    res.status(500).render('error', { message: 'Error loading message' });
  }
});

// Update message status (staff only)
router.post('/messages/:id/status', requireAuth, requireStaff, async (req, res) => {
  try {
    const messageId = req.params.id;
    const { status } = req.body;
    
    if (!['unread', 'read', 'replied'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    await db.query('UPDATE contact_messages SET status = $1 WHERE id = $2', [status, messageId]);
    
    res.redirect(`/contact/messages/${messageId}`);
  } catch (error) {
    console.error('Error updating message status:', error);
    res.status(500).render('error', { message: 'Error updating message status' });
  }
});

// Delete contact message (staff only)
router.post('/messages/:id/delete', requireAuth, requireStaff, async (req, res) => {
  try {
    const messageId = req.params.id;
    await db.query('DELETE FROM contact_messages WHERE id = $1', [messageId]);
    res.redirect('/contact/messages');
  } catch (error) {
    console.error('Error deleting contact message:', error);
    res.status(500).render('error', { message: 'Error deleting message' });
  }
});

module.exports = router; 