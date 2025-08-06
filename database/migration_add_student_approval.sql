-- Migration to add student approval functionality and notifications

-- Add approval status to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id);
ALTER TABLE students ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE students ADD COLUMN IF NOT EXISTS approval_notes TEXT;

-- Create notifications table for admin notifications
CREATE TABLE IF NOT EXISTS admin_notifications (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL, -- 'student_added', 'user_registered', etc.
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    related_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    related_student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for notifications
CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON admin_notifications(type);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_is_read ON admin_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_students_is_approved ON students(is_approved); 