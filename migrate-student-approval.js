const db = require('./config/database');

async function migrateStudentApproval() {
    try {
        console.log('🚀 Running student approval migration...\n');
        
        // Add approval status to students table
        console.log('📋 Adding approval columns to students table...');
        await db.query(`
            ALTER TABLE students ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;
            ALTER TABLE students ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id);
            ALTER TABLE students ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
            ALTER TABLE students ADD COLUMN IF NOT EXISTS approval_notes TEXT;
        `);
        console.log('✅ Student approval columns added successfully!\n');
        
        // Create notifications table for admin notifications
        console.log('📋 Creating admin notifications table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS admin_notifications (
                id SERIAL PRIMARY KEY,
                type VARCHAR(50) NOT NULL,
                title VARCHAR(200) NOT NULL,
                message TEXT NOT NULL,
                related_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                related_student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Admin notifications table created successfully!\n');
        
        // Create indexes for notifications
        console.log('📋 Creating indexes...');
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON admin_notifications(type);
            CREATE INDEX IF NOT EXISTS idx_admin_notifications_is_read ON admin_notifications(is_read);
            CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications(created_at);
            CREATE INDEX IF NOT EXISTS idx_students_is_approved ON students(is_approved);
        `);
        console.log('✅ Indexes created successfully!\n');
        
        // Update existing students to be approved (for backward compatibility)
        console.log('📋 Updating existing students to approved status...');
        await db.query(`
            UPDATE students SET is_approved = TRUE WHERE is_approved IS NULL OR is_approved = FALSE;
        `);
        console.log('✅ Existing students updated to approved status!\n');
        
        console.log('🎉 Student approval migration completed successfully!');
        console.log('\n📝 New features added:');
        console.log('1. Students now require admin approval before being active');
        console.log('2. Admin notifications for new student additions');
        console.log('3. Approval tracking with timestamps and notes');
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

// Run migration if this file is executed directly
if (require.main === module) {
    migrateStudentApproval();
}

module.exports = migrateStudentApproval; 