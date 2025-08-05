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

// Middleware to check if user is parent (allows unapproved parents for student management)
const requireParent = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'parent') {
    return res.status(403).render('error', { message: 'Access denied. Parents only.' });
  }
  next();
};

// Middleware to check if user is teacher or admin
const requireTeacherOrAdmin = (req, res, next) => {
  if (!req.session.user || (req.session.user.role !== 'teacher' && req.session.user.role !== 'admin')) {
    return res.status(403).render('error', { message: 'Access denied. Teachers and admins only.' });
  }
  next();
};

// View parent's students
router.get('/my-students', requireAuth, requireParent, async (req, res) => {
  try {
    // Check if parent is approved
    if (!req.session.user.is_approved) {
      return res.redirect('/auth/pending-approval');
    }
    
    const parentId = req.session.user.id;
    
    const result = await db.query(`
      SELECT * FROM students 
      WHERE parent_id = $1 
      ORDER BY grade, first_name, last_name
    `, [parentId]);
    
    res.render('students/my-students', { 
      students: result.rows,
      user: req.session.user,
      error: null
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.render('students/my-students', { 
      students: [],
      user: req.session.user,
      error: 'Error loading students'
    });
  }
});

// Add student form
router.get('/add', requireAuth, requireParent, (req, res) => {
  const welcome = req.query.welcome === 'true';
  res.render('students/add', { user: req.session.user, welcome, error: null });
});

// Add student POST
router.post('/add', requireAuth, requireParent, async (req, res) => {
  try {
    const { index_no, first_name, last_name, grade } = req.body;
    const parentId = req.session.user.id;
    
    if (!index_no || !first_name || !last_name || !grade) {
      return res.render('students/add', { 
        user: req.session.user,
        error: 'All fields are required'
      });
    }
    
    // Validate grade
    const validGrades = ['Form I', 'Form II', 'Form III', 'Form IV'];
    if (!validGrades.includes(grade)) {
      return res.render('students/add', { 
        user: req.session.user,
        error: 'Invalid grade selected'
      });
    }
    
    // Check if index number already exists
    const existingStudent = await db.query('SELECT * FROM students WHERE index_no = $1', [index_no]);
    if (existingStudent.rows.length > 0) {
      return res.render('students/add', { 
        user: req.session.user,
        error: 'Student with this index number already exists'
      });
    }
    
    // Insert new student
    await db.query(
      'INSERT INTO students (index_no, first_name, last_name, grade, parent_id) VALUES ($1, $2, $3, $4, $5)',
      [index_no, first_name, last_name, grade, parentId]
    );
    
    res.redirect('/students/my-students');
  } catch (error) {
    console.error('Error adding student:', error);
    res.render('students/add', { 
      user: req.session.user,
      error: 'Error adding student'
    });
  }
});

// Edit student form
router.get('/edit/:id', requireAuth, requireParent, async (req, res) => {
  try {
    const studentId = req.params.id;
    const parentId = req.session.user.id;
    
    const result = await db.query(`
      SELECT * FROM students 
      WHERE id = $1 AND parent_id = $2
    `, [studentId, parentId]);
    
    if (result.rows.length === 0) {
      return res.status(404).render('error', { message: 'Student not found' });
    }
    
    const student = result.rows[0];
    res.render('students/edit', { student, user: req.session.user });
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).render('error', { message: 'Error loading student' });
  }
});

// Update student POST
router.post('/edit/:id', requireAuth, requireParent, async (req, res) => {
  try {
    const studentId = req.params.id;
    const parentId = req.session.user.id;
    const { index_no, first_name, last_name, grade } = req.body;
    
    if (!index_no || !first_name || !last_name || !grade) {
      return res.status(400).render('error', { message: 'All fields are required' });
    }
    
    // Validate grade
    const validGrades = ['Form I', 'Form II', 'Form III', 'Form IV'];
    if (!validGrades.includes(grade)) {
      return res.status(400).render('error', { message: 'Invalid grade selected' });
    }
    
    // Check if student belongs to parent
    const studentCheck = await db.query(`
      SELECT * FROM students 
      WHERE id = $1 AND parent_id = $2
    `, [studentId, parentId]);
    
    if (studentCheck.rows.length === 0) {
      return res.status(404).render('error', { message: 'Student not found' });
    }
    
    // Check if index number already exists for another student
    const existingStudent = await db.query(`
      SELECT * FROM students 
      WHERE index_no = $1 AND id != $2
    `, [index_no, studentId]);
    
    if (existingStudent.rows.length > 0) {
      return res.status(400).render('error', { message: 'Student with this index number already exists' });
    }
    
    // Update student
    await db.query(`
      UPDATE students 
      SET index_no = $1, first_name = $2, last_name = $3, grade = $4, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $5
    `, [index_no, first_name, last_name, grade, studentId]);
    
    res.redirect('/students/my-students');
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).render('error', { message: 'Error updating student' });
  }
});

// Delete student
router.post('/delete/:id', requireAuth, requireParent, async (req, res) => {
  try {
    const studentId = req.params.id;
    const parentId = req.session.user.id;
    
    // Check if student belongs to parent
    const studentCheck = await db.query(`
      SELECT * FROM students 
      WHERE id = $1 AND parent_id = $2
    `, [studentId, parentId]);
    
    if (studentCheck.rows.length === 0) {
      return res.status(404).render('error', { message: 'Student not found' });
    }
    
    // Delete student
    await db.query('DELETE FROM students WHERE id = $1', [studentId]);
    
    res.redirect('/students/my-students');
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).render('error', { message: 'Error deleting student' });
  }
});

// Search students (for teachers and admins)
router.get('/search', requireAuth, requireTeacherOrAdmin, async (req, res) => {
  try {
    const { query } = req.query;
    let students = [];
    
    if (query) {
      const result = await db.query(`
        SELECT s.*, u.name as parent_name, u.email as parent_email
        FROM students s
        JOIN users u ON s.parent_id = u.id
        WHERE s.index_no ILIKE $1 
           OR s.first_name ILIKE $1 
           OR s.last_name ILIKE $1
           OR CONCAT(s.first_name, ' ', s.last_name) ILIKE $1
        ORDER BY s.grade, s.first_name, s.last_name
      `, [`%${query}%`]);
      
      students = result.rows;
    }
    
    res.render('students/search', { 
      students,
      query: query || '',
      user: req.session.user,
      error: null
    });
  } catch (error) {
    console.error('Error searching students:', error);
    res.render('students/search', { 
      students: [],
      query: '',
      user: req.session.user,
      error: 'Error searching students'
    });
  }
});

// View all students (admin only)
router.get('/all', requireAuth, async (req, res) => {
  try {
    if (req.session.user.role !== 'admin') {
      return res.status(403).render('error', { message: 'Access denied. Admin only.' });
    }
    
    const result = await db.query(`
      SELECT s.*, u.name as parent_name, u.email as parent_email, u.is_approved as parent_approved
      FROM students s
      JOIN users u ON s.parent_id = u.id
      ORDER BY s.grade, s.first_name, s.last_name
    `);
    
    res.render('students/all', { 
      students: result.rows,
      user: req.session.user,
      error: null
    });
  } catch (error) {
    console.error('Error fetching all students:', error);
    res.render('students/all', { 
      students: [],
      user: req.session.user,
      error: 'Error loading students'
    });
  }
});

// View student details (admin only)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    if (req.session.user.role !== 'admin') {
      return res.status(403).render('error', { message: 'Access denied. Admin only.' });
    }
    
    const studentId = req.params.id;
    const result = await db.query(`
      SELECT s.*, u.name as parent_name, u.email as parent_email, u.is_approved as parent_approved, u.created_at as parent_created_at
      FROM students s
      JOIN users u ON s.parent_id = u.id
      WHERE s.id = $1
    `, [studentId]);
    
    if (result.rows.length === 0) {
      return res.status(404).render('error', { message: 'Student not found' });
    }
    
    const student = result.rows[0];
    res.render('students/view', { 
      student,
      user: req.session.user,
      error: null
    });
  } catch (error) {
    console.error('Error fetching student details:', error);
    res.status(500).render('error', { message: 'Error loading student details' });
  }
});

module.exports = router; 