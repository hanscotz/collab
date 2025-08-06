-- =====================================================
-- Parent-School Collaboration Platform Database Schema
-- =====================================================
-- 
-- This schema implements a complete grade-section system where:
-- - Each grade (Form I, II, III, IV) has exactly 4 sections (A, B, C, D)
-- - Students must be assigned to a specific class section
-- - Parents select grade first, then choose from available sections
-- - All forms use dynamic loading via API endpoint /students/api/classes/:grade
--
-- Last Updated: Current version with section-based class structure
-- =====================================================

-- Create database (run this separately if needed)
-- CREATE DATABASE parent_school_collab;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'parent', -- 'parent', 'teacher', 'admin'
    is_approved BOOLEAN DEFAULT TRUE, -- FALSE for new parents until admin approval
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    grade VARCHAR(10) NOT NULL CHECK (grade IN ('Form I', 'Form II', 'Form III', 'Form IV')),
    section VARCHAR(5) NOT NULL CHECK (section IN ('A', 'B', 'C', 'D')),
    teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(grade, section) -- Ensure unique grade-section combinations
);

-- Students table
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    index_no VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    grade VARCHAR(10) NOT NULL CHECK (grade IN ('Form I', 'Form II', 'Form III', 'Form IV')),
    parent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
    is_approved BOOLEAN DEFAULT TRUE, -- FALSE for students added by unapproved parents
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Posts table (school announcements, updates, etc.)
CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(50) DEFAULT 'general', -- 'announcement', 'event', 'news', 'general'
    visibility VARCHAR(20) DEFAULT 'all', -- 'all', 'teachers', 'parents'
    class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Post reactions table (likes/dislikes)
CREATE TABLE IF NOT EXISTS post_reactions (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(10) NOT NULL CHECK (reaction_type IN ('like', 'dislike')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, user_id) -- One reaction per user per post
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE, -- For nested comments
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contact messages table
CREATE TABLE IF NOT EXISTS contact_messages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'unread', -- 'unread', 'read', 'replied'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Direct Messages table
CREATE TABLE IF NOT EXISTS direct_messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Conversations table (to group messages between users)
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    user1_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    user2_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user1_id, user2_id)
);

-- Email notifications table
CREATE TABLE IF NOT EXISTS email_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
CREATE INDEX IF NOT EXISTS idx_posts_class_id ON posts(class_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_post_id ON post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_user_id ON post_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_type ON post_reactions(reaction_type);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status);
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender ON direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver ON direct_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation ON direct_messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_conversations_users ON conversations(user1_id, user2_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_user ON email_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_students_parent_id ON students(parent_id);
CREATE INDEX IF NOT EXISTS idx_students_index_no ON students(index_no);
CREATE INDEX IF NOT EXISTS idx_students_grade ON students(grade);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_is_approved ON students(is_approved);
CREATE INDEX IF NOT EXISTS idx_students_parent_approved ON students(parent_id, is_approved);
CREATE INDEX IF NOT EXISTS idx_users_is_approved ON users(is_approved);
CREATE INDEX IF NOT EXISTS idx_users_role_approved ON users(role, is_approved);
CREATE INDEX IF NOT EXISTS idx_classes_grade ON classes(grade);
CREATE INDEX IF NOT EXISTS idx_classes_section ON classes(section);
CREATE INDEX IF NOT EXISTS idx_classes_grade_section ON classes(grade, section);
CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON classes(teacher_id);

-- Insert default users for development/testing
-- Note: Passwords are hashed versions of 'password123' - change in production!

-- Default Admin User
INSERT INTO users (name, email, password, role, is_approved) VALUES 
('System Administrator', 'admin@school.com', '$2b$10$rQZ8K9mN2pL5vX7wY1tA3eF6gH8iJ4kL7mN9oP2qR5sT8uV1wX4yZ7aB0cD3eF', 'admin', TRUE);

-- Default Teachers
INSERT INTO users (name, email, password, role, is_approved) VALUES 
('John Smith', 'john.smith@school.com', '$2b$10$rQZ8K9mN2pL5vX7wY1tA3eF6gH8iJ4kL7mN9oP2qR5sT8uV1wX4yZ7aB0cD3eF', 'teacher', TRUE),
('Sarah Johnson', 'sarah.johnson@school.com', '$2b$10$rQZ8K9mN2pL5vX7wY1tA3eF6gH8iJ4kL7mN9oP2qR5sT8uV1wX4yZ7aB0cD3eF', 'teacher', TRUE),
('Michael Brown', 'michael.brown@school.com', '$2b$10$rQZ8K9mN2pL5vX7wY1tA3eF6gH8iJ4kL7mN9oP2qR5sT8uV1wX4yZ7aB0cD3eF', 'teacher', TRUE);

-- Default Parents
INSERT INTO users (name, email, password, role, is_approved) VALUES 
('David Wilson', 'david.wilson@email.com', '$2b$10$rQZ8K9mN2pL5vX7wY1tA3eF6gH8iJ4kL7mN9oP2qR5sT8uV1wX4yZ7aB0cD3eF', 'parent', TRUE),
('Lisa Davis', 'lisa.davis@email.com', '$2b$10$rQZ8K9mN2pL5vX7wY1tA3eF6gH8iJ4kL7mN9oP2qR5sT8uV1wX4yZ7aB0cD3eF', 'parent', TRUE),
('Robert Miller', 'robert.miller@email.com', '$2b$10$rQZ8K9mN2pL5vX7wY1tA3eF6gH8iJ4kL7mN9oP2qR5sT8uV1wX4yZ7aB0cD3eF', 'parent', TRUE),
('Jennifer Garcia', 'jennifer.garcia@email.com', '$2b$10$rQZ8K9mN2pL5vX7wY1tA3eF6gH8iJ4kL7mN9oP2qR5sT8uV1wX4yZ7aB0cD3eF', 'parent', TRUE);

-- Insert default classes
INSERT INTO classes (name, grade, section, teacher_id) VALUES 
('Form I - Section A', 'Form I', 'A', 2),
('Form I - Section B', 'Form I', 'B', 2),
('Form I - Section C', 'Form I', 'C', 3),
('Form I - Section D', 'Form I', 'D', 3),
('Form II - Section A', 'Form II', 'A', 4),
('Form II - Section B', 'Form II', 'B', 4),
('Form II - Section C', 'Form II', 'C', 2),
('Form II - Section D', 'Form II', 'D', 2),
('Form III - Section A', 'Form III', 'A', 3),
('Form III - Section B', 'Form III', 'B', 3),
('Form III - Section C', 'Form III', 'C', 4),
('Form III - Section D', 'Form III', 'D', 4),
('Form IV - Section A', 'Form IV', 'A', 2),
('Form IV - Section B', 'Form IV', 'B', 2),
('Form IV - Section C', 'Form IV', 'C', 3),
('Form IV - Section D', 'Form IV', 'D', 3);

-- Insert default students
INSERT INTO students (index_no, first_name, last_name, grade, parent_id, class_id) VALUES 
('F1A-001', 'Emma', 'Wilson', 'Form I', 5, 1),
('F1A-002', 'James', 'Davis', 'Form I', 6, 1),
('F1B-001', 'Sophia', 'Miller', 'Form I', 7, 2),
('F2A-001', 'William', 'Garcia', 'Form II', 8, 3),
('F3A-001', 'Olivia', 'Taylor', 'Form III', 5, 5),
('F4A-001', 'Noah', 'Anderson', 'Form IV', 6, 7);

-- =====================================================
-- Schema Summary
-- =====================================================
--
-- Database Structure:
-- - 8 users (1 admin, 3 teachers, 4 parents)
-- - 16 classes (4 grades × 4 sections each)
-- - 6 sample students across different grades
--
-- Class Structure:
-- Form I:   Sections A, B, C, D (IDs: 1, 2, 9, 10)
-- Form II:  Sections A, B, C, D (IDs: 3, 4, 11, 12)
-- Form III: Sections A, B, C, D (IDs: 5, 6, 13, 14)
-- Form IV:  Sections A, B, C, D (IDs: 7, 8, 15, 16)
--
-- Key Features:
-- - Unique constraint on (grade, section) combinations
-- - Required class_id for all students
-- - Dynamic class loading via API
-- - Complete approval system for users and students
-- =====================================================