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

// Add comment to a post
router.post('/:postId', requireAuth, async (req, res) => {
  try {
    const postId = req.params.postId;
    const { content, parentId } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.redirect(`/posts/${postId}?error=Comment content is required`);
    }
    
    // Verify post exists
    const postResult = await db.query('SELECT * FROM posts WHERE id = $1', [postId]);
    if (postResult.rows.length === 0) {
      return res.status(404).render('error', { message: 'Post not found' });
    }
    
    // If this is a reply, verify parent comment exists
    if (parentId) {
      const parentResult = await db.query('SELECT * FROM comments WHERE id = $1 AND post_id = $2', [parentId, postId]);
      if (parentResult.rows.length === 0) {
        return res.status(404).render('error', { message: 'Parent comment not found' });
      }
    }
    
    const result = await db.query(
      'INSERT INTO comments (content, user_id, post_id, parent_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [content.trim(), req.session.user.id, postId, parentId || null]
    );
    
    res.redirect(`/posts/${postId}#comment-${result.rows[0].id}`);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.redirect(`/posts/${req.params.postId}?error=Error adding comment`);
  }
});

// Edit comment form
router.get('/:id/edit', requireAuth, async (req, res) => {
  try {
    const commentId = req.params.id;
    const result = await db.query(`
      SELECT c.*, p.title as post_title 
      FROM comments c 
      JOIN posts p ON c.post_id = p.id 
      WHERE c.id = $1
    `, [commentId]);
    
    if (result.rows.length === 0) {
      return res.status(404).render('error', { message: 'Comment not found' });
    }
    
    const comment = result.rows[0];
    
    // Check if user is the author or admin
    if (comment.user_id !== req.session.user.id && req.session.user.role !== 'admin') {
      return res.status(403).render('error', { message: 'Access denied' });
    }
    
    res.render('comments/edit', { comment, user: req.session.user });
  } catch (error) {
    console.error('Error fetching comment for edit:', error);
    res.status(500).render('error', { message: 'Error loading comment' });
  }
});

// Update comment
router.post('/:id/edit', requireAuth, async (req, res) => {
  try {
    const commentId = req.params.id;
    const { content } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.render('comments/edit', { 
        comment: { id: commentId, content: content || '' },
        user: req.session.user,
        error: 'Comment content is required'
      });
    }
    
    // Check if user is the author or admin
    const commentResult = await db.query('SELECT * FROM comments WHERE id = $1', [commentId]);
    if (commentResult.rows.length === 0) {
      return res.status(404).render('error', { message: 'Comment not found' });
    }
    
    const comment = commentResult.rows[0];
    if (comment.user_id !== req.session.user.id && req.session.user.role !== 'admin') {
      return res.status(403).render('error', { message: 'Access denied' });
    }
    
    await db.query(
      'UPDATE comments SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [content.trim(), commentId]
    );
    
    res.redirect(`/posts/${comment.post_id}#comment-${commentId}`);
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).render('error', { message: 'Error updating comment' });
  }
});

// Delete comment
router.post('/:id/delete', requireAuth, async (req, res) => {
  try {
    const commentId = req.params.id;
    
    // Check if user is the author or admin
    const commentResult = await db.query('SELECT * FROM comments WHERE id = $1', [commentId]);
    if (commentResult.rows.length === 0) {
      return res.status(404).render('error', { message: 'Comment not found' });
    }
    
    const comment = commentResult.rows[0];
    if (comment.user_id !== req.session.user.id && req.session.user.role !== 'admin') {
      return res.status(403).render('error', { message: 'Access denied' });
    }
    
    await db.query('DELETE FROM comments WHERE id = $1', [commentId]);
    res.redirect(`/posts/${comment.post_id}`);
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).render('error', { message: 'Error deleting comment' });
  }
});

module.exports = router; 