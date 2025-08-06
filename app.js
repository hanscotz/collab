const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
require('dotenv').config({ path: './config.env' });

const db = require('./config/database');
const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const commentRoutes = require('./routes/comments');
const contactRoutes = require('./routes/contact');
const messageRoutes = require('./routes/messages');
const userRoutes = require('./routes/users');
const studentRoutes = require('./routes/students');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Static file serving
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    httpOnly: true, // Prevent XSS attacks
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'strict' // Prevent CSRF attacks
  },
  name: 'parent-school-session' // Custom session name
}));

// Set EJS as view engine and layout
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Global middleware to make user available to all views and track session activity
app.use((req, res, next) => {
  res.locals.user = req.session.user;
  res.locals.isAuthenticated = !!req.session.user;
  
  // Track session activity for timeout
  if (req.session.user) {
    req.session.lastActivity = Date.now();
  }
  
  // Check for session timeout (30 minutes of inactivity)
  const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  if (req.session.user && req.session.lastActivity && 
      (Date.now() - req.session.lastActivity) > SESSION_TIMEOUT) {
    // Session expired, destroy it
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
      }
      console.log('Session expired due to inactivity');
    });
    return res.redirect('/auth/login?message=Session expired due to inactivity. Please login again.');
  }
  
  next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/posts', postRoutes);
app.use('/comments', commentRoutes);
app.use('/contact', contactRoutes);
app.use('/messages', messageRoutes);
app.use('/users', userRoutes);
app.use('/students', studentRoutes);

// Home route
app.get('/', async (req, res) => {
  try {
    // Check if user is a parent and not approved
    if (req.session.user && req.session.user.role === 'parent' && !req.session.user.is_approved) {
      return res.redirect('/auth/pending-approval');
    }
    
    let query = `
      SELECT p.*, u.name as author_name, u.role as author_role,
             (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
      FROM posts p 
      JOIN users u ON p.user_id = u.id 
    `;
    const params = [];
    let whereClause = [];
    
    // Add visibility filtering based on user authentication status
    if (req.session.user) {
      const userRole = req.session.user.role;
      if (userRole === 'parent') {
        whereClause.push(`(p.visibility = 'all' OR p.visibility = 'parents')`);
        
        // Add grade-based filtering for parents (only approved students)
        const studentGradesResult = await db.query(`
          SELECT DISTINCT grade FROM students WHERE parent_id = $1 AND is_approved = TRUE
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
      // For non-authenticated users, only show posts visible to all with general target grades
      whereClause.push(`p.visibility = 'all'`);
      whereClause.push(`p.target_grades = 'all'`);
    }
    
    if (whereClause.length > 0) {
      query += ' WHERE ' + whereClause.join(' AND ');
    }
    
    query += ' ORDER BY p.is_pinned DESC, p.created_at DESC LIMIT 10';
    
    const result = await db.query(query, params);
    
    res.render('index', { 
      posts: result.rows,
      user: req.session.user 
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.render('index', { posts: [], user: req.session.user });
  }
});

// About page
app.get('/about', (req, res) => {
  res.render('about');
});

// Test logout page
app.get('/test-logout', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-logout.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
}); 