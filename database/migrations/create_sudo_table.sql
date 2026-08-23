-- Create sudo_users table
CREATE TABLE IF NOT EXISTS sudo_users (
  id SERIAL PRIMARY KEY,
  user_jid TEXT UNIQUE NOT NULL,
  added_by TEXT NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sudo_users_jid ON sudo_users(user_jid);
