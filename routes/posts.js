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

// Middleware to check if user is admin (only admins can create announcements)
const requireAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).render('error', { message: 'Access denied. Admin only.' });
  }
  next();
};

// View all posts
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = `
      SELECT p.*, u.name as author_name, u.role as author_role,
             (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
             (SELECT COUNT(*) FROM post_reactions WHERE post_id = p.id AND reaction_type = 'like') as like_count,
             (SELECT COUNT(*) FROM post_reactions WHERE post_id = p.id AND reaction_type = 'dislike') as dislike_count
      FROM posts p 
      JOIN users u ON p.user_id = u.id 
    `;
    const params = [];
    let whereClause = [];
    
    // Add visibility filtering based on user role
    if (req.session.user) {
      const userRole = req.session.user.role;
      if (userRole === 'parent') {
        whereClause.push(`(p.visibility = 'all' OR p.visibility = 'parents')`);
        
        // Add grade-based filtering for parents
        const studentGradesResult = await db.query(`
          SELECT DISTINCT grade FROM students WHERE parent_id = $1
        `, [req.session.user.id]);
        
        if (studentGradesResult.rows.length > 0) {
          const studentGrades = studentGradesResult.rows.map(row => row.grade);
          const gradeConditions = studentGrades.map(grade => `p.target_grades LIKE '%${grade}%'`);
          gradeConditions.push(`p.target_grades = 'all'`);
          whereClause.push(`(${gradeConditions.join(' OR ')})`);
        } else {
          // If parent has no students, only show general posts
          whereClause.push(`p.target_grades = 'all'`);
        }
      } else if (userRole === 'teacher') {
        whereClause.push(`(p.visibility = 'all' OR p.visibility = 'teachers')`);
      }
      // Admins can see all posts, so no additional filter needed
    } else {
      // For non-authenticated users, only show posts visible to all
      whereClause.push(`p.visibility = 'all'`);
      whereClause.push(`p.target_grades = 'all'`);
    }
    
    if (category && category !== 'all') {
      whereClause.push(`p.category = $${params.length + 1}`);
      params.push(category);
    }
    
    if (search) {
      whereClause.push(`(p.title ILIKE $${params.length + 1} OR p.content ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    
    if (whereClause.length > 0) {
      query += ' WHERE ' + whereClause.join(' AND ');
    }
    
    query += ' ORDER BY p.is_pinned DESC, p.created_at DESC';
    
    const result = await db.query(query, params);
    
    // Add user reactions to posts if user is authenticated
    if (req.session.user) {
      for (let post of result.rows) {
        const userReactionResult = await db.query(
          'SELECT reaction_type FROM post_reactions WHERE post_id = $1 AND user_id = $2',
          [post.id, req.session.user.id]
        );
        post.userReaction = userReactionResult.rows.length > 0 ? userReactionResult.rows[0].reaction_type : null;
      }
    }
    
    res.render('posts/index', { 
      posts: result.rows,
      user: req.session.user,
      currentCategory: category || 'all',
      search: search || ''
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.render('posts/index', { 
      posts: [],
      user: req.session.user,
      currentCategory: 'all',
      search: ''
    });
  }
});

// Create new post form (admin only)
router.get('/new', requireAuth, requireAdmin, (req, res) => {
  res.render('posts/new', { user: req.session.user });
});

// View single post
router.get('/:id', async (req, res) => {
  try {
    const postId = req.params.id;
    
    // Get post details with reaction counts
    const postResult = await db.query(`
      SELECT p.*, u.name as author_name, u.role as author_role,
             (SELECT COUNT(*) FROM post_reactions WHERE post_id = p.id AND reaction_type = 'like') as like_count,
             (SELECT COUNT(*) FROM post_reactions WHERE post_id = p.id AND reaction_type = 'dislike') as dislike_count
      FROM posts p 
      JOIN users u ON p.user_id = u.id 
      WHERE p.id = $1
    `, [postId]);
    
    if (postResult.rows.length === 0) {
      return res.status(404).render('error', { message: 'Post not found' });
    }
    
    const post = postResult.rows[0];
    
    // Get user's reaction if authenticated
    if (req.session.user) {
      const userReactionResult = await db.query(
        'SELECT reaction_type FROM post_reactions WHERE post_id = $1 AND user_id = $2',
        [postId, req.session.user.id]
      );
      post.userReaction = userReactionResult.rows.length > 0 ? userReactionResult.rows[0].reaction_type : null;
    }
    
    // Check visibility based on user role
    if (req.session.user) {
      const userRole = req.session.user.role;
      if (userRole === 'parent' && post.visibility === 'teachers') {
        return res.status(403).render('error', { message: 'Access denied. This post is only visible to teachers.' });
      } else if (userRole === 'teacher' && post.visibility === 'parents') {
        return res.status(403).render('error', { message: 'Access denied. This post is only visible to parents.' });
      }
    } else {
      // For non-authenticated users, only show posts visible to all
      if (post.visibility !== 'all') {
        return res.status(403).render('error', { message: 'Access denied. Please log in to view this post.' });
      }
    }
    
    // Get comments for this post with optimized query
    const commentsResult = await db.query(`
      SELECT c.*, u.name as author_name, u.role as author_role 
      FROM comments c 
      JOIN users u ON c.user_id = u.id 
      WHERE c.post_id = $1 AND c.parent_id IS NULL
      ORDER BY c.created_at ASC
    `, [postId]);
    
    res.render('posts/show', { 
      post,
      comments: commentsResult.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).render('error', { message: 'Error loading post' });
  }
});

// Create new post (admin only)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, content, category, visibility, target_grades } = req.body;
    
    if (!title || !content || !visibility) {
      return res.render('posts/new', { 
        user: req.session.user,
        error: 'Title, content, and visibility are required'
      });
    }
    
    const result = await db.query(
      'INSERT INTO posts (title, content, category, visibility, target_grades, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [title, content, category || 'general', visibility, target_grades || 'all', req.session.user.id]
    );
    
    res.redirect(`/posts/${result.rows[0].id}`);
  } catch (error) {
    console.error('Error creating post:', error);
    res.render('posts/new', { 
      user: req.session.user,
      error: 'Error creating post'
    });
  }
});

// Edit post form (admin only)
router.get('/:id/edit', requireAuth, requireAdmin, async (req, res) => {
  try {
    const postId = req.params.id;
    const result = await db.query('SELECT * FROM posts WHERE id = $1', [postId]);
    
    if (result.rows.length === 0) {
      return res.status(404).render('error', { message: 'Post not found' });
    }
    
    const post = result.rows[0];
    
    // Only admins can edit posts
    if (req.session.user.role !== 'admin') {
      return res.status(403).render('error', { message: 'Access denied. Admin only.' });
    }
    
    res.render('posts/edit', { post, user: req.session.user });
  } catch (error) {
    console.error('Error fetching post for edit:', error);
    res.status(500).render('error', { message: 'Error loading post' });
  }
});

// Update post (admin only)
router.post('/:id/edit', requireAuth, requireAdmin, async (req, res) => {
  try {
    const postId = req.params.id;
    const { title, content, category, visibility, target_grades } = req.body;
    
    if (!title || !content || !visibility) {
      return res.status(400).render('error', { message: 'Title, content, and visibility are required' });
    }
    
    // Check if post exists
    const postResult = await db.query('SELECT * FROM posts WHERE id = $1', [postId]);
    if (postResult.rows.length === 0) {
      return res.status(404).render('error', { message: 'Post not found' });
    }
    
    // Only admins can update posts
    if (req.session.user.role !== 'admin') {
      return res.status(403).render('error', { message: 'Access denied. Admin only.' });
    }
    
    await db.query(
      'UPDATE posts SET title = $1, content = $2, category = $3, visibility = $4, target_grades = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6',
      [title, content, category || 'general', visibility, target_grades || 'all', postId]
    );
    
    res.redirect(`/posts/${postId}`);
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).render('error', { message: 'Error updating post' });
  }
});

// Delete post (admin only)
router.post('/:id/delete', requireAuth, requireAdmin, async (req, res) => {
  try {
    const postId = req.params.id;

    // Check if post exists
    const postResult = await db.query('SELECT * FROM posts WHERE id = $1', [postId]);
    if (postResult.rows.length === 0) {
      return res.status(404).render('error', { message: 'Post not found' });
    }

    // Only admins can delete posts
    if (req.session.user.role !== 'admin') {
      return res.status(403).render('error', { message: 'Access denied. Admin only.' });
    }

    await db.query('DELETE FROM posts WHERE id = $1', [postId]);
    res.redirect('/posts');
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).render('error', { message: 'Error deleting post' });
  }
});

// Get post reaction details (admin only)
router.get('/:id/reactions', requireAuth, requireAdmin, async (req, res) => {
  try {
    const postId = req.params.id;

    // Check if post exists
    const postResult = await db.query('SELECT * FROM posts WHERE id = $1', [postId]);
    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Get all reactions with user details
    const reactionsResult = await db.query(`
      SELECT pr.*, u.name as user_name, u.role as user_role, u.email as user_email
      FROM post_reactions pr
      JOIN users u ON pr.user_id = u.id
      WHERE pr.post_id = $1
      ORDER BY pr.created_at DESC
    `, [postId]);

    // Separate likes and dislikes
    const likes = reactionsResult.rows.filter(r => r.reaction_type === 'like');
    const dislikes = reactionsResult.rows.filter(r => r.reaction_type === 'dislike');

    res.json({
      success: true,
      likes: likes,
      dislikes: dislikes,
      total_likes: likes.length,
      total_dislikes: dislikes.length
    });
  } catch (error) {
    console.error('Error fetching reaction details:', error);
    res.status(500).json({ error: 'Error fetching reaction details' });
  }
});

// Like/Dislike post (all authenticated users)
router.post('/:id/react', requireAuth, async (req, res) => {
  try {
    const postId = req.params.id;
    const { reaction_type } = req.body;
    const userId = req.session.user.id;

    // Validate reaction type
    if (!reaction_type || !['like', 'dislike'].includes(reaction_type)) {
      return res.status(400).json({ error: 'Invalid reaction type' });
    }

    // Check if post exists
    const postResult = await db.query('SELECT * FROM posts WHERE id = $1', [postId]);
    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if user already has a reaction for this post
    const existingReaction = await db.query(
      'SELECT * FROM post_reactions WHERE post_id = $1 AND user_id = $2',
      [postId, userId]
    );

    if (existingReaction.rows.length > 0) {
      const existingType = existingReaction.rows[0].reaction_type;
      
      if (existingType === reaction_type) {
        // Remove reaction if clicking the same type
        await db.query(
          'DELETE FROM post_reactions WHERE post_id = $1 AND user_id = $2',
          [postId, userId]
        );
      } else {
        // Update reaction if changing type
        await db.query(
          'UPDATE post_reactions SET reaction_type = $1 WHERE post_id = $2 AND user_id = $3',
          [reaction_type, postId, userId]
        );
      }
    } else {
      // Add new reaction
      await db.query(
        'INSERT INTO post_reactions (post_id, user_id, reaction_type) VALUES ($1, $2, $3)',
        [postId, userId, reaction_type]
      );
    }

    // Get updated reaction counts
    const likeCount = await db.query(
      'SELECT COUNT(*) as count FROM post_reactions WHERE post_id = $1 AND reaction_type = $2',
      [postId, 'like']
    );

    const dislikeCount = await db.query(
      'SELECT COUNT(*) as count FROM post_reactions WHERE post_id = $1 AND reaction_type = $2',
      [postId, 'dislike']
    );

    // Get user's current reaction
    const userReaction = await db.query(
      'SELECT reaction_type FROM post_reactions WHERE post_id = $1 AND user_id = $2',
      [postId, userId]
    );

    res.json({
      success: true,
      likes: parseInt(likeCount.rows[0].count),
      dislikes: parseInt(dislikeCount.rows[0].count),
      userReaction: userReaction.rows.length > 0 ? userReaction.rows[0].reaction_type : null
    });
  } catch (error) {
    console.error('Error handling reaction:', error);
    res.status(500).json({ error: 'Error processing reaction' });
  }
});

module.exports = router; 