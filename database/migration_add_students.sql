-- Migration: Add students table and grade targeting for posts
-- Run this after the initial schema.sql

-- Add students table
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    index_no VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    grade VARCHAR(10) NOT NULL CHECK (grade IN ('Form I', 'Form II', 'Form III', 'Form IV')),
    parent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add target_grades column to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS target_grades VARCHAR(100) DEFAULT 'all';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_students_parent_id ON students(parent_id);
CREATE INDEX IF NOT EXISTS idx_students_index_no ON students(index_no);
CREATE INDEX IF NOT EXISTS idx_students_grade ON students(grade);
CREATE INDEX IF NOT EXISTS idx_posts_target_grades ON posts(target_grades);

-- Insert sample students
INSERT INTO students (index_no, first_name, last_name, grade, parent_id) VALUES
('2024001', 'Michael', 'Smith', 'Form I', 2),
('2024002', 'Emily', 'Smith', 'Form III', 2),
('2024003', 'David', 'Johnson', 'Form II', 3),
('2024004', 'Lisa', 'Johnson', 'Form IV', 3)
ON CONFLICT (index_no) DO NOTHING;

-- Update existing posts with grade targeting
UPDATE posts SET target_grades = 'all' WHERE target_grades IS NULL;

-- Add some grade-specific sample posts
INSERT INTO posts (title, content, user_id, category, target_grades) VALUES
('Form I Orientation Program', 'All Form I students and their parents are invited to attend the orientation program on September 5th at 9 AM in the school hall.', 1, 'event', 'Form I'),
('Form III Science Fair Guidelines', 'Form III students, please note the updated guidelines for the upcoming science fair. Projects are due by November 10th.', 4, 'news', 'Form III'),
('Form II Mathematics Competition', 'Form II students will participate in the inter-school mathematics competition on October 15th. Please register by September 30th.', 4, 'event', 'Form II'),
('Form IV Mock Examinations', 'Form IV students will have their mock examinations from October 20th to 25th. Please ensure all students are prepared.', 1, 'announcement', 'Form IV')
ON CONFLICT DO NOTHING; 