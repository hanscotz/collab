const db = require('./config/database');

async function migrateApproval() {
    try {
        console.log('🚀 Running approval system migration...\n');
        
        // Add is_approved column to users table
        console.log('📋 Adding is_approved column to users table...');
        await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT TRUE');
        console.log('✅ is_approved column added successfully!\n');
        
        // Update existing users to be approved
        console.log('📋 Updating existing users approval status...');
        await db.query('UPDATE users SET is_approved = TRUE WHERE role IN (\'admin\', \'teacher\')');
        await db.query('UPDATE users SET is_approved = TRUE WHERE role = \'parent\'');
        console.log('✅ Existing users updated successfully!\n');
        
        // Create indexes for better performance
        console.log('📋 Creating indexes for approval queries...');
        await db.query('CREATE INDEX IF NOT EXISTS idx_users_is_approved ON users(is_approved)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_users_role_approved ON users(role, is_approved)');
        console.log('✅ Indexes created successfully!\n');
        
        console.log('🎉 Migration completed successfully!');
        console.log('\n📝 The approval system is now active:');
        console.log('- New parent registrations will require admin approval');
        console.log('- Existing parents are automatically approved');
        console.log('- Admins can approve/reject parent accounts from the Users page');
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

// Run migration if this file is executed directly
if (require.main === module) {
    migrateApproval();
}

module.exports = migrateApproval; 