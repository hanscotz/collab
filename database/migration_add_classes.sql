-- Migration to add classes table and update posts for class-based announcements

-- Create classes table
CREATE TABLE IF NOT EXISTS classes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    grade VARCHAR(10) NOT NULL CHECK (grade IN ('Form I', 'Form II', 'Form III', 'Form IV')),
    teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add class_id to posts table for class-specific announcements
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'posts' AND column_name = 'class_id'
    ) THEN
        ALTER TABLE posts ADD COLUMN class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add class_id to students table to link students to specific classes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'students' AND column_name = 'class_id'
    ) THEN
        ALTER TABLE students ADD COLUMN class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_classes_grade ON classes(grade);
CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_posts_class_id ON posts(class_id);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);

-- Insert sample classes
INSERT INTO classes (name, grade, teacher_id) VALUES
('Form I A', 'Form I', NULL),
('Form I B', 'Form I', NULL),
('Form II A', 'Form II', NULL),
('Form II B', 'Form II', NULL),
('Form III A', 'Form III', NULL),
('Form III B', 'Form III', NULL),
('Form IV A', 'Form IV', NULL),
('Form IV B', 'Form IV', NULL)
ON CONFLICT DO NOTHING;

-- Update existing posts to have NULL class_id (general announcements)
UPDATE posts SET class_id = NULL WHERE class_id IS NULL; 