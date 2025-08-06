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

// View all students (admin only)
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT s.*, u.name as parent_name, u.email as parent_email, c.name as class_name
      FROM students s
      LEFT JOIN users u ON s.parent_id = u.id
      LEFT JOIN classes c ON s.class_id = c.id
      ORDER BY s.grade, s.first_name, s.last_name
    `);
    
    res.render('students/index', { 
      students: result.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.render('students/index', { 
      students: [],
      user: req.session.user,
      error: 'Error loading students'
    });
  }
});

// Add new student form (admin only)
router.get('/new', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Get all parents
    const parentsResult = await db.query('SELECT id, name, email FROM users WHERE role = \'parent\' AND is_approved = TRUE ORDER BY name');
    
    // Get all classes
    const classesResult = await db.query('SELECT id, name, grade FROM classes ORDER BY grade, name');
    
    res.render('students/new', { 
      parents: parentsResult.rows,
      classes: classesResult.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading student form:', error);
    res.status(500).render('error', { message: 'Error loading form' });
  }
});

// Create new student (admin only)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { index_no, first_name, last_name, grade, parent_id, class_id } = req.body;
    
    if (!index_no || !first_name || !last_name || !grade || !parent_id) {
      return res.render('students/new', { 
        user: req.session.user,
        error: 'All fields except class are required'
      });
    }
    
    // Check if student index number already exists
    const existingStudent = await db.query('SELECT * FROM students WHERE index_no = $1', [index_no]);
    if (existingStudent.rows.length > 0) {
      return res.render('students/new', { 
        user: req.session.user,
        error: 'Student with this index number already exists'
      });
    }
    
    // Convert empty string to null for class_id
    const classId = class_id === '' ? null : parseInt(class_id);
    
    const result = await db.query(
      'INSERT INTO students (index_no, first_name, last_name, grade, parent_id, class_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [index_no, first_name, last_name, grade, parent_id, classId]
    );
    
    res.redirect('/students');
  } catch (error) {
    console.error('Error creating student:', error);
    res.render('students/new', { 
      user: req.session.user,
      error: 'Error creating student'
    });
  }
});

// Edit student form (admin only)
router.get('/:id/edit', requireAuth, requireAdmin, async (req, res) => {
  try {
    const studentId = req.params.id;
    
    // Get student details
    const studentResult = await db.query('SELECT * FROM students WHERE id = $1', [studentId]);
    if (studentResult.rows.length === 0) {
      return res.status(404).render('error', { message: 'Student not found' });
    }
    
    const student = studentResult.rows[0];
    
    // Get all parents
    const parentsResult = await db.query('SELECT id, name, email FROM users WHERE role = \'parent\' AND is_approved = TRUE ORDER BY name');
    
    // Get all classes
    const classesResult = await db.query('SELECT id, name, grade FROM classes ORDER BY grade, name');
    
    res.render('students/edit', { 
      student,
      parents: parentsResult.rows,
      classes: classesResult.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading student for edit:', error);
    res.status(500).render('error', { message: 'Error loading student' });
  }
});

// Update student (admin only)
router.post('/:id/edit', requireAuth, requireAdmin, async (req, res) => {
  try {
    const studentId = req.params.id;
    const { index_no, first_name, last_name, grade, parent_id, class_id } = req.body;
    
    if (!index_no || !first_name || !last_name || !grade || !parent_id) {
      return res.status(400).render('error', { message: 'All fields except class are required' });
    }
    
    // Check if student exists
    const studentResult = await db.query('SELECT * FROM students WHERE id = $1', [studentId]);
    if (studentResult.rows.length === 0) {
      return res.status(404).render('error', { message: 'Student not found' });
    }
    
    // Check if index number is already taken by another student
    const existingStudent = await db.query('SELECT * FROM students WHERE index_no = $1 AND id != $2', [index_no, studentId]);
    if (existingStudent.rows.length > 0) {
      return res.status(400).render('error', { message: 'Student with this index number already exists' });
    }
    
    // Convert empty string to null for class_id
    const classId = class_id === '' ? null : parseInt(class_id);
    
    await db.query(
      'UPDATE students SET index_no = $1, first_name = $2, last_name = $3, grade = $4, parent_id = $5, class_id = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7',
      [index_no, first_name, last_name, grade, parent_id, classId, studentId]
    );
    
    res.redirect('/students');
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).render('error', { message: 'Error updating student' });
  }
});

// Delete student (admin only)
router.post('/:id/delete', requireAuth, requireAdmin, async (req, res) => {
  try {
    const studentId = req.params.id;
    
    // Check if student exists
    const studentResult = await db.query('SELECT * FROM students WHERE id = $1', [studentId]);
    if (studentResult.rows.length === 0) {
      return res.status(404).render('error', { message: 'Student not found' });
    }
    
    await db.query('DELETE FROM students WHERE id = $1', [studentId]);
    res.redirect('/students');
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).render('error', { message: 'Error deleting student' });
  }
});

module.exports = router; 