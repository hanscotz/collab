const bcrypt = require('bcrypt');
const db = require('./config/database');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
    try {
        console.log('🚀 Setting up Parent-School Hub database...\n');
        
        // Read and execute schema
        const schemaPath = path.join(__dirname, 'database', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('📋 Creating database tables...');
        await db.query(schema);
        console.log('✅ Database tables created successfully!\n');
        
        // Create admin user if not exists
        console.log('👤 Setting up admin user...');
        const adminEmail = 'admin@school.com';
        const adminPassword = 'password123';
        
        const existingAdmin = await db.query('SELECT * FROM users WHERE email = $1', [adminEmail]);
        
        if (existingAdmin.rows.length === 0) {
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            await db.query(
                'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
                ['School Admin', adminEmail, hashedPassword, 'admin']
            );
            console.log('✅ Admin user created successfully!');
            console.log(`   Email: ${adminEmail}`);
            console.log(`   Password: ${adminPassword}\n`);
        } else {
            console.log('ℹ️  Admin user already exists\n');
        }
        
        console.log('🎉 Setup completed successfully!');
        console.log('\n📝 Next steps:');
        console.log('1. Start the application: npm start');
        console.log('2. Open http://localhost:3000 in your browser');
        console.log('3. Login with the admin credentials above');
        console.log('\nHappy coding! 🚀');
        
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        console.log('\n🔧 Troubleshooting:');
        console.log('1. Make sure PostgreSQL is running');
        console.log('2. Check your database configuration in config.env');
        console.log('3. Ensure the database exists');
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

// Run setup if this file is executed directly
if (require.main === module) {
    setupDatabase();
}

module.exports = setupDatabase; 