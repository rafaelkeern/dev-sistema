/*
  # Fix Authentication System

  1. Tables
    - Drop and recreate users table with proper structure
    - Add proper RLS policies for authentication
    - Insert admin user with correct data

  2. Security
    - Enable RLS on users table
    - Add policies for service role and authenticated users
    - Allow public access for login verification
*/

-- Drop existing table and recreate
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password text NOT NULL,
  nome text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role can manage users"
  ON users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow public read for authentication (login)
CREATE POLICY "Public can read users for auth"
  ON users
  FOR SELECT
  TO anon
  USING (true);

-- Allow authenticated users to read their own data
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = id::text);

-- Insert admin user
INSERT INTO users (username, password, nome) 
VALUES ('admin', 'admin123', 'Administrador')
ON CONFLICT (username) DO UPDATE SET
  password = EXCLUDED.password,
  nome = EXCLUDED.nome,
  updated_at = now();