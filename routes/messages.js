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

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).render('error', { message: 'Access denied. Admin only.' });
  }
  next();
};

// View all conversations
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    // Get all conversations for the current user
    const conversationsResult = await db.query(`
      SELECT 
        c.id,
        c.last_message_at,
        CASE 
          WHEN c.user1_id = $1 THEN u2.id
          ELSE u1.id
        END as other_user_id,
        CASE 
          WHEN c.user1_id = $1 THEN u2.name
          ELSE u1.name
        END as other_user_name,
        CASE 
          WHEN c.user1_id = $1 THEN u2.email
          ELSE u1.email
        END as other_user_email,
        CASE 
          WHEN c.user1_id = $1 THEN u2.role
          ELSE u1.role
        END as other_user_role,
        (SELECT COUNT(*) FROM direct_messages dm 
         WHERE ((dm.sender_id = $1 AND dm.receiver_id = CASE WHEN c.user1_id = $1 THEN u2.id ELSE u1.id END) 
                OR (dm.sender_id = CASE WHEN c.user1_id = $1 THEN u2.id ELSE u1.id END AND dm.receiver_id = $1))
         AND dm.is_read = false AND dm.receiver_id = $1) as unread_count
      FROM conversations c
      JOIN users u1 ON c.user1_id = u1.id
      JOIN users u2 ON c.user2_id = u2.id
      WHERE c.user1_id = $1 OR c.user2_id = $1
      ORDER BY c.last_message_at DESC
    `, [userId]);

    res.render('messages/index', { 
      conversations: conversationsResult.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.render('messages/index', { 
      conversations: [],
      user: req.session.user,
      error: 'Error loading conversations'
    });
  }
});

// View conversation with specific user
router.get('/conversation/:userId', requireAuth, async (req, res) => {
  try {
    const currentUserId = req.session.user.id;
    const otherUserId = req.params.userId;
    
    // Get other user info
    const otherUserResult = await db.query('SELECT * FROM users WHERE id = $1', [otherUserId]);
    if (otherUserResult.rows.length === 0) {
      return res.status(404).render('error', { message: 'User not found' });
    }
    const otherUser = otherUserResult.rows[0];
    
    // Get or create conversation
    let conversationResult = await db.query(`
      SELECT * FROM conversations 
      WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)
    `, [currentUserId, otherUserId]);
    
    if (conversationResult.rows.length === 0) {
      // Create new conversation
      conversationResult = await db.query(`
        INSERT INTO conversations (user1_id, user2_id) 
        VALUES ($1, $2) RETURNING *
      `, [currentUserId, otherUserId]);
    }
    
    // Get messages
    const messagesResult = await db.query(`
      SELECT dm.*, u.name as sender_name, u.role as sender_role
      FROM direct_messages dm
      JOIN users u ON dm.sender_id = u.id
      WHERE (dm.sender_id = $1 AND dm.receiver_id = $2) 
         OR (dm.sender_id = $2 AND dm.receiver_id = $1)
      ORDER BY dm.created_at ASC
    `, [currentUserId, otherUserId]);
    
    // Mark messages as read
    await db.query(`
      UPDATE direct_messages 
      SET is_read = true 
      WHERE receiver_id = $1 AND sender_id = $2 AND is_read = false
    `, [currentUserId, otherUserId]);
    
    res.render('messages/conversation', { 
      messages: messagesResult.rows,
      otherUser: otherUser,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).render('error', { message: 'Error loading conversation' });
  }
});

// Send message
router.post('/send', requireAuth, async (req, res) => {
  try {
    const { receiver_id, subject, message } = req.body;
    const sender_id = req.session.user.id;
    
    if (!receiver_id || !subject || !message) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Insert message
    await db.query(`
      INSERT INTO direct_messages (sender_id, receiver_id, subject, message) 
      VALUES ($1, $2, $3, $4)
    `, [sender_id, receiver_id, subject, message]);
    
    // Update conversation timestamp
    await db.query(`
      UPDATE conversations 
      SET last_message_at = CURRENT_TIMESTAMP 
      WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)
    `, [sender_id, receiver_id]);
    
    res.redirect(`/messages/conversation/${receiver_id}`);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Error sending message' });
  }
});

// Start new conversation (admin only)
router.get('/new', requireAuth, async (req, res) => {
  try {
    // Get all users except current user
    const usersResult = await db.query(`
      SELECT id, name, email, role 
      FROM users 
      WHERE id != $1 
      ORDER BY name
    `, [req.session.user.id]);
    
    res.render('messages/new', { 
      users: usersResult.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading users:', error);
    res.render('messages/new', { 
      users: [],
      user: req.session.user,
      error: 'Error loading users'
    });
  }
});

// Start new conversation POST
router.post('/new', requireAuth, async (req, res) => {
  try {
    const { receiver_id, subject, message } = req.body;
    const sender_id = req.session.user.id;
    
    if (!receiver_id || !subject || !message) {
      return res.render('messages/new', { 
        users: [],
        user: req.session.user,
        error: 'All fields are required'
      });
    }
    
    // Insert message
    await db.query(`
      INSERT INTO direct_messages (sender_id, receiver_id, subject, message) 
      VALUES ($1, $2, $3, $4)
    `, [sender_id, receiver_id, subject, message]);
    
    // Create or update conversation
    await db.query(`
      INSERT INTO conversations (user1_id, user2_id, last_message_at) 
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (user1_id, user2_id) 
      DO UPDATE SET last_message_at = CURRENT_TIMESTAMP
    `, [sender_id, receiver_id]);
    
    res.redirect(`/messages/conversation/${receiver_id}`);
  } catch (error) {
    console.error('Error starting conversation:', error);
    res.render('messages/new', { 
      users: [],
      user: req.session.user,
      error: 'Error starting conversation'
    });
  }
});

// Delete message (admin or message sender only)
router.post('/delete/:messageId', requireAuth, async (req, res) => {
  try {
    const messageId = req.params.messageId;
    const userId = req.session.user.id;
    
    // Check if user can delete this message
    const messageResult = await db.query(`
      SELECT * FROM direct_messages WHERE id = $1
    `, [messageId]);
    
    if (messageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    const message = messageResult.rows[0];
    if (message.sender_id !== userId && req.session.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this message' });
    }
    
    // Delete message
    await db.query('DELETE FROM direct_messages WHERE id = $1', [messageId]);
    
    res.redirect(`/messages/conversation/${message.receiver_id === userId ? message.sender_id : message.receiver_id}`);
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Error deleting message' });
  }
});

module.exports = router; 