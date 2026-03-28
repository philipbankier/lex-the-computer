-- Phase 4a: Services table and sites.pid column

CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(8) NOT NULL,
  port INTEGER,
  entrypoint TEXT,
  working_dir TEXT,
  env_vars JSONB,
  is_running BOOLEAN DEFAULT false NOT NULL,
  public_url VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='sites' AND column_name='pid'
  ) THEN
    ALTER TABLE sites ADD COLUMN pid INTEGER;
  END IF;
END$$;

