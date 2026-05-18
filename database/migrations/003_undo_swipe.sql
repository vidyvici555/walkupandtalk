-- Migration 003: Track last swipe per user for undo feature
CREATE TABLE IF NOT EXISTS user_last_swipe (
  user_id   UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  swiped_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction VARCHAR(10) NOT NULL,
  swiped_at TIMESTAMPTZ DEFAULT NOW()
);
