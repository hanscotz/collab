-- Migration: Add visibility column to posts table
-- Run this script to add the visibility column to existing databases

-- Add visibility column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'posts' AND column_name = 'visibility'
    ) THEN
        ALTER TABLE posts ADD COLUMN visibility VARCHAR(20) DEFAULT 'all';
    END IF;
END $$;

-- Update existing posts to have 'all' visibility
UPDATE posts SET visibility = 'all' WHERE visibility IS NULL; 