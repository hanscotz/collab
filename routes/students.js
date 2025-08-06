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

// Middleware to check if user is an unapproved parent
const requireUnapprovedParent = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'parent' || req.session.user.is_approved) {
    return res.status(403).render('error', { message: 'Access denied. Unapproved parents only.' });
  }
  next();
};

// Middleware to check if user is an approved parent
const requireApprovedParent = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'parent' || !req.session.user.is_approved) {
    return res.status(403).render('error', { message: 'Access denied. Approved parents only.' });
  }
  next();
};

// Add my children form (unapproved parents only)
router.get('/add-my-children', requireAuth, requireUnapprovedParent, async (req, res) => {
  try {
    // Get all classes for dropdown
    const classesResult = await db.query('SELECT id, name, grade FROM classes ORDER BY grade, name');
    
    // Get existing children of this parent
    const childrenResult = await db.query(`
      SELECT s.*, c.name as class_name 
      FROM students s 
      LEFT JOIN classes c ON s.class_id = c.id 
      WHERE s.parent_id = $1 
      ORDER BY s.grade, s.first_name, s.last_name
    `, [req.session.user.id]);
    
    res.render('students/add-my-children', { 
      classes: classesResult.rows,
      children: childrenResult.rows,
      user: req.session.user,
      success: req.query.success === 'true',
      error: null
    });
  } catch (error) {
    console.error('Error loading add children form:', error);
    res.status(500).render('error', { message: 'Error loading form' });
  }
});

// Create new child (unapproved parents only)
router.post('/add-my-children', requireAuth, requireUnapprovedParent, async (req, res) => {
  try {
    const { index_no, first_name, last_name, grade, class_id } = req.body;
    const parentId = req.session.user.id;
    
    if (!index_no || !first_name || !last_name || !grade || !class_id) {
      return res.render('students/add-my-children', { 
        user: req.session.user,
        error: 'All fields are required',
        classes: [],
        children: [],
        success: false
      });
    }
    
    // Check if student index number already exists
    const existingStudent = await db.query('SELECT * FROM students WHERE index_no = $1', [index_no]);
    if (existingStudent.rows.length > 0) {
      return res.render('students/add-my-children', { 
        user: req.session.user,
        error: 'Student with this index number already exists',
        classes: [],
        children: [],
        success: false
      });
    }
    
    const classId = parseInt(class_id);
    
    const result = await db.query(
      'INSERT INTO students (index_no, first_name, last_name, grade, parent_id, class_id, is_approved) VALUES ($1, $2, $3, $4, $5, $6, FALSE) RETURNING *',
      [index_no, first_name, last_name, grade, parentId, classId]
    );
    
    res.redirect('/students/add-my-children?success=true');
  } catch (error) {
    console.error('Error creating child:', error);
    res.render('students/add-my-children', { 
      user: req.session.user,
      error: 'Error creating child',
      classes: [],
      children: [],
      success: false
    });
  }
});

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
      user: req.session.user,
      error: null,
      success: req.query.success === 'true',
      updated: req.query.updated === 'true',
      deleted: req.query.deleted === 'true'
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
      user: req.session.user,
      error: null
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
    
    if (!index_no || !first_name || !last_name || !grade || !parent_id || !class_id) {
      return res.render('students/new', { 
        user: req.session.user,
        error: 'All fields are required',
        parents: [],
        classes: []
      });
    }
    
    // Check if student index number already exists
    const existingStudent = await db.query('SELECT * FROM students WHERE index_no = $1', [index_no]);
    if (existingStudent.rows.length > 0) {
      return res.render('students/new', { 
        user: req.session.user,
        error: 'Student with this index number already exists',
        parents: [],
        classes: []
      });
    }
    
    const classId = parseInt(class_id);
    
    const result = await db.query(
      'INSERT INTO students (index_no, first_name, last_name, grade, parent_id, class_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [index_no, first_name, last_name, grade, parent_id, classId]
    );
    
    res.redirect('/students');
  } catch (error) {
    console.error('Error creating student:', error);
    res.render('students/new', { 
      user: req.session.user,
      error: 'Error creating student',
      parents: [],
      classes: []
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
      user: req.session.user,
      error: null
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
    
    if (!index_no || !first_name || !last_name || !grade || !parent_id || !class_id) {
      return res.status(400).render('error', { message: 'All fields are required' });
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
    
    const classId = parseInt(class_id);
    
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

// Approve student (admin only)
router.post('/:id/approve', requireAuth, requireAdmin, async (req, res) => {
  try {
    const studentId = req.params.id;
    
    // Check if student exists
    const studentResult = await db.query('SELECT * FROM students WHERE id = $1', [studentId]);
    if (studentResult.rows.length === 0) {
      return res.status(404).render('error', { message: 'Student not found' });
    }
    
    await db.query('UPDATE students SET is_approved = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [studentId]);
    res.redirect('/students');
  } catch (error) {
    console.error('Error approving student:', error);
    res.status(500).render('error', { message: 'Error approving student' });
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

// Parent panel - View my children (approved parents only)
router.get('/my-children', requireAuth, requireApprovedParent, async (req, res) => {
  try {
    const childrenResult = await db.query(`
      SELECT s.*, c.name as class_name 
      FROM students s 
      LEFT JOIN classes c ON s.class_id = c.id 
      WHERE s.parent_id = $1 
      ORDER BY s.grade, s.first_name, s.last_name
    `, [req.session.user.id]);
    
    res.render('students/my-children', { 
      children: childrenResult.rows,
      user: req.session.user,
      error: null
    });
  } catch (error) {
    console.error('Error fetching children:', error);
    res.render('students/my-children', { 
      children: [],
      user: req.session.user,
      error: 'Error loading children'
    });
  }
});

// Add new child form (approved parents only)
router.get('/my-children/add', requireAuth, requireApprovedParent, async (req, res) => {
  try {
    // Get all classes for dropdown
    const classesResult = await db.query('SELECT id, name, grade FROM classes ORDER BY grade, name');
    
    res.render('students/add-child', { 
      classes: classesResult.rows,
      user: req.session.user,
      error: null
    });
  } catch (error) {
    console.error('Error loading add child form:', error);
    res.status(500).render('error', { message: 'Error loading form' });
  }
});

// Create new child (approved parents only)
router.post('/my-children/add', requireAuth, requireApprovedParent, async (req, res) => {
  try {
    const { index_no, first_name, last_name, grade, class_id } = req.body;
    const parentId = req.session.user.id;
    
    if (!index_no || !first_name || !last_name || !grade || !class_id) {
      return res.render('students/add-child', { 
        user: req.session.user,
        error: 'All fields are required',
        classes: []
      });
    }
    
    // Check if student index number already exists
    const existingStudent = await db.query('SELECT * FROM students WHERE index_no = $1', [index_no]);
    if (existingStudent.rows.length > 0) {
      return res.render('students/add-child', { 
        user: req.session.user,
        error: 'Student with this index number already exists',
        classes: []
      });
    }
    
    const classId = parseInt(class_id);
    
    const result = await db.query(
      'INSERT INTO students (index_no, first_name, last_name, grade, parent_id, class_id, is_approved) VALUES ($1, $2, $3, $4, $5, $6, FALSE) RETURNING *',
      [index_no, first_name, last_name, grade, parentId, classId]
    );
    
    res.redirect('/students/my-children?success=true');
  } catch (error) {
    console.error('Error creating child:', error);
    res.render('students/add-child', { 
      user: req.session.user,
      error: 'Error creating child',
      classes: []
    });
  }
});

// Edit child form (approved parents only)
router.get('/my-children/:id/edit', requireAuth, requireApprovedParent, async (req, res) => {
  try {
    const studentId = req.params.id;
    const parentId = req.session.user.id;
    
    // Get student details and verify ownership
    const studentResult = await db.query('SELECT * FROM students WHERE id = $1 AND parent_id = $2', [studentId, parentId]);
    if (studentResult.rows.length === 0) {
      return res.status(404).render('error', { message: 'Student not found' });
    }
    
    const student = studentResult.rows[0];
    
    // Get all classes for dropdown
    const classesResult = await db.query('SELECT id, name, grade FROM classes ORDER BY grade, name');
    
    res.render('students/edit-child', { 
      student,
      classes: classesResult.rows,
      user: req.session.user,
      error: null
    });
  } catch (error) {
    console.error('Error loading child for edit:', error);
    res.status(500).render('error', { message: 'Error loading child' });
  }
});

// Update child (approved parents only)
router.post('/my-children/:id/edit', requireAuth, requireApprovedParent, async (req, res) => {
  try {
    const studentId = req.params.id;
    const parentId = req.session.user.id;
    const { index_no, first_name, last_name, grade, class_id } = req.body;
    
    if (!index_no || !first_name || !last_name || !grade || !class_id) {
      return res.status(400).render('error', { message: 'All fields are required' });
    }
    
    // Check if student exists and belongs to this parent
    const studentResult = await db.query('SELECT * FROM students WHERE id = $1 AND parent_id = $2', [studentId, parentId]);
    if (studentResult.rows.length === 0) {
      return res.status(404).render('error', { message: 'Student not found' });
    }
    
    // Check if index number is already taken by another student
    const existingStudent = await db.query('SELECT * FROM students WHERE index_no = $1 AND id != $2', [index_no, studentId]);
    if (existingStudent.rows.length > 0) {
      return res.status(400).render('error', { message: 'Student with this index number already exists' });
    }
    
    const classId = parseInt(class_id);
    
    await db.query(
      'UPDATE students SET index_no = $1, first_name = $2, last_name = $3, grade = $4, class_id = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 AND parent_id = $7',
      [index_no, first_name, last_name, grade, classId, studentId, parentId]
    );
    
    res.redirect('/students/my-children?updated=true');
  } catch (error) {
    console.error('Error updating child:', error);
    res.status(500).render('error', { message: 'Error updating child' });
  }
});

// Delete child (approved parents only)
router.post('/my-children/:id/delete', requireAuth, requireApprovedParent, async (req, res) => {
  try {
    const studentId = req.params.id;
    const parentId = req.session.user.id;
    
    // Check if student exists and belongs to this parent
    const studentResult = await db.query('SELECT * FROM students WHERE id = $1 AND parent_id = $2', [studentId, parentId]);
    if (studentResult.rows.length === 0) {
      return res.status(404).render('error', { message: 'Student not found' });
    }
    
    await db.query('DELETE FROM students WHERE id = $1 AND parent_id = $2', [studentId, parentId]);
    res.redirect('/students/my-children?deleted=true');
  } catch (error) {
    console.error('Error deleting child:', error);
    res.status(500).render('error', { message: 'Error deleting child' });
  }
});

// API endpoint to get classes by grade
router.get('/api/classes/:grade', requireAuth, async (req, res) => {
  try {
    const grade = req.params.grade;
    
    // Validate grade
    const validGrades = ['Form I', 'Form II', 'Form III', 'Form IV'];
    if (!validGrades.includes(grade)) {
      return res.status(400).json({ error: 'Invalid grade' });
    }
    
    // Get classes for the specified grade
    const classesResult = await db.query(
      'SELECT id, name, grade, section FROM classes WHERE grade = $1 ORDER BY section',
      [grade]
    );
    
    res.json(classesResult.rows);
  } catch (error) {
    console.error('Error fetching classes by grade:', error);
    res.status(500).json({ error: 'Error fetching classes' });
  }
});

module.exports = router; 