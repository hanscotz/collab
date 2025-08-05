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

-- Students table
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

-- Posts table (school announcements, updates, etc.)
CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(50) DEFAULT 'general', -- 'announcement', 'event', 'news', 'general'
    visibility VARCHAR(20) DEFAULT 'all', -- 'all', 'teachers', 'parents'
    target_grades VARCHAR(100) DEFAULT 'all', -- 'all' or comma-separated grades like 'Form I,Form II'
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
CREATE INDEX IF NOT EXISTS idx_posts_target_grades ON posts(target_grades);
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
CREATE INDEX IF NOT EXISTS idx_users_is_approved ON users(is_approved);
CREATE INDEX IF NOT EXISTS idx_users_role_approved ON users(role, is_approved);

-- Insert sample data
INSERT INTO users (name, email, password, role) VALUES
('School Admin', 'admin@school.com', '$2b$10$rQZ8K9mN2pL1vX3yA6bC7dE8fG9hI0jK1lM2nO3pQ4rS5tU6vW7xY8zA9bC0dE1f', 'admin'),
('John Smith', 'parent@school.com', '$2b$10$rQZ8K9mN2pL1vX3yA6bC7dE8fG9hI0jK1lM2nO3pQ4rS5tU6vW7xY8zA9bC0dE1f', 'parent'),
('Sarah Johnson', 'sarah.johnson@email.com', '$2b$10$rQZ8K9mN2pL1vX3yA6bC7dE8fG9hI0jK1lM2nO3pQ4rS5tU6vW7xY8zA9bC0dE1f', 'parent'),
('Mrs. Davis', 'teacher@school.com', '$2b$10$rQZ8K9mN2pL1vX3yA6bC7dE8fG9hI0jK1lM2nO3pQ4rS5tU6vW7xY8zA9bC0dE1f', 'teacher')
ON CONFLICT (email) DO NOTHING;

-- Insert sample students
INSERT INTO students (index_no, first_name, last_name, grade, parent_id) VALUES
('2024001', 'Michael', 'Smith', 'Form I', 2),
('2024002', 'Emily', 'Smith', 'Form III', 2),
('2024003', 'David', 'Johnson', 'Form II', 3),
('2024004', 'Lisa', 'Johnson', 'Form IV', 3)
ON CONFLICT (index_no) DO NOTHING;

-- Insert sample posts with grade targeting
INSERT INTO posts (title, content, user_id, category, target_grades) VALUES
('Welcome Back to School!', 'Dear parents and students, welcome back to another exciting school year. We have many wonderful activities planned for this semester.', 1, 'announcement', 'all'),
('Form I Orientation Program', 'All Form I students and their parents are invited to attend the orientation program on September 5th at 9 AM in the school hall.', 1, 'event', 'Form I'),
('Form III Science Fair Guidelines', 'Form III students, please note the updated guidelines for the upcoming science fair. Projects are due by November 10th.', 4, 'news', 'Form III'),
('Form II Mathematics Competition', 'Form II students will participate in the inter-school mathematics competition on October 15th. Please register by September 30th.', 4, 'event', 'Form II'),
('Form IV Mock Examinations', 'Form IV students will have their mock examinations from October 20th to 25th. Please ensure all students are prepared.', 1, 'announcement', 'Form IV'),
('School Lunch Menu - October', 'Check out this month''s nutritious and delicious lunch menu. We''re introducing new healthy options!', 1, 'general', 'all')
ON CONFLICT DO NOTHING;

-- Insert sample post reactions
INSERT INTO post_reactions (post_id, user_id, reaction_type) VALUES
(1, 2, 'like'),
(1, 3, 'like'),
(1, 4, 'like'),
(2, 2, 'like'),
(3, 2, 'like'),
(4, 3, 'like'),
(5, 3, 'like'),
(6, 2, 'like'),
(6, 3, 'like'),
(6, 4, 'dislike')
ON CONFLICT DO NOTHING;

-- Insert sample direct messages
INSERT INTO direct_messages (sender_id, receiver_id, subject, message) VALUES
(1, 2, 'Welcome to the School Portal', 'Hello John, welcome to our school portal! Feel free to reach out if you have any questions.'),
(2, 1, 'Thank you for the welcome', 'Thank you for the warm welcome! I''m excited to be part of this community.'),
(1, 4, 'Teacher Meeting Reminder', 'Hi Mrs. Davis, just a reminder about our staff meeting tomorrow at 3 PM.'),
(4, 1, 'Meeting Confirmation', 'Thank you for the reminder. I''ll be there at 3 PM sharp.')
ON CONFLICT DO NOTHING; 