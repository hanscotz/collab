-- Migration: Add post reactions table for likes/dislikes
-- Run this script to add the post_reactions table to existing databases

-- Create post_reactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS post_reactions (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(10) NOT NULL CHECK (reaction_type IN ('like', 'dislike')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, user_id) -- One reaction per user per post
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_post_reactions_post_id ON post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_user_id ON post_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_type ON post_reactions(reaction_type);

-- Insert sample reactions for existing posts (optional)
INSERT INTO post_reactions (post_id, user_id, reaction_type) VALUES
(1, 2, 'like'),
(1, 3, 'like'),
(1, 4, 'like'),
(2, 2, 'like'),
(2, 3, 'dislike'),
(3, 2, 'like'),
(4, 2, 'like'),
(4, 3, 'like'),
(4, 4, 'dislike')
ON CONFLICT DO NOTHING; 