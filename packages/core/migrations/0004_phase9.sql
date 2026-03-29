-- Phase 9: Onboarding & Polish

-- Add onboarding flag to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false NOT NULL;

-- User profiles for onboarding
CREATE TABLE IF NOT EXISTS user_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  display_name VARCHAR(255),
  bio TEXT,
  interests JSONB,
  social_links JSONB,
  avatar_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  type VARCHAR(32) NOT NULL,
  read BOOLEAN DEFAULT false NOT NULL,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Extend datasets table
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS schema_def JSONB;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS row_count INTEGER;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
