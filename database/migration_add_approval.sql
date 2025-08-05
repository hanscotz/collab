-- Migration to add approval system for parent accounts
-- Add is_approved column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT TRUE;

-- Update existing users to be approved (except new parents)
UPDATE users SET is_approved = TRUE WHERE role IN ('admin', 'teacher');

-- Set all existing parents to approved (for existing data)
UPDATE users SET is_approved = TRUE WHERE role = 'parent';

-- Create index for better performance on approval queries
CREATE INDEX IF NOT EXISTS idx_users_is_approved ON users(is_approved);
CREATE INDEX IF NOT EXISTS idx_users_role_approved ON users(role, is_approved); 