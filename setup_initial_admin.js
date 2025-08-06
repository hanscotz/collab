const bcrypt = require('bcrypt');
const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'parent_school_collab',
  password: 'hansco',
  port: 5432,
});

async function setupInitialAdmin() {
  try {
    console.log('Setting up initial admin account...');
    
    // Check if admin already exists
    const existingAdmin = await pool.query('SELECT * FROM users WHERE role = \'admin\'');
    
    if (existingAdmin.rows.length > 0) {
      console.log('✅ Admin account already exists. Skipping setup.');
      return;
    }
    
    // Create admin password hash
    const adminPassword = 'admin123'; // Change this to your desired admin password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);
    
    // Insert admin user
    await pool.query(
      'INSERT INTO users (name, email, password, role, is_approved) VALUES ($1, $2, $3, $4, $5)',
      ['School Administrator', 'admin@school.com', hashedPassword, 'admin', true]
    );
    
    console.log('✅ Initial admin account created successfully!');
    console.log('📧 Email: admin@school.com');
    console.log('🔑 Password: admin123');
    console.log('⚠️  Please change the password after first login!');
    
  } catch (error) {
    console.error('❌ Error setting up admin account:', error);
  } finally {
    await pool.end();
  }
}

setupInitialAdmin(); 