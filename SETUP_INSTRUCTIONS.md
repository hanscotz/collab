# School Collaboration Portal - Setup Instructions

## Database Setup

### 1. Create Database
```sql
CREATE DATABASE parent_school_collab;
```

### 2. Run Schema
Execute the `database/schema.sql` file to create all tables and indexes:
```bash
psql -U postgres -d parent_school_collab -f database/schema.sql
```

### 3. Create Initial Admin Account
Run the setup script to create the initial administrator account:
```bash
node setup_initial_admin.js
```

**Default Admin Credentials:**
- Email: `admin@school.com`
- Password: `admin123`

⚠️ **Important:** Change the admin password after first login!

## Application Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create a `.env` file in the root directory:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=parent_school_collab
DB_USER=postgres
DB_PASSWORD=hansco
PORT=3000
```

### 3. Start the Application
```bash
npm start
```

The application will be available at `http://localhost:3000`

## Features Overview

### For Administrators
- Create and manage school announcements
- Approve parent registrations
- Manage students and classes
- View post reactions and analytics
- Approve students added by unapproved parents

### For Parents
- Register for an account (requires admin approval)
- Add children while waiting for approval
- View announcements relevant to their children's classes
- Like/dislike announcements
- Send direct messages

### For Teachers
- View announcements
- Like/dislike announcements
- Send direct messages

## User Registration Flow

1. **Parent Registration:**
   - Parent registers with email and password
   - Account is created with `is_approved = FALSE`
   - Parent is redirected to pending approval page
   - Parent can add their children while waiting

2. **Admin Approval:**
   - Admin logs in and sees pending parent registrations
   - Admin approves parent account
   - Admin can also approve children added by parents

3. **Access Control:**
   - Only approved parents can access the main dashboard
   - Only approved students can access class-specific announcements
   - Parents only see announcements for classes their approved children are enrolled in

## Security Features

- Password hashing with bcrypt
- Session-based authentication
- Role-based access control
- Input validation and sanitization
- SQL injection prevention with parameterized queries

## Database Schema

The system includes the following main tables:
- `users` - User accounts (parents, teachers, admins)
- `students` - Student information linked to parents
- `classes` - Class information
- `posts` - School announcements and updates
- `post_reactions` - Like/dislike functionality
- `comments` - Comments on posts
- `direct_messages` - Private messaging system
- `contact_messages` - Contact form submissions

## Support

For technical support or questions, please contact the development team. 