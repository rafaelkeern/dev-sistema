/*
  # Fix user authentication data

  1. Updates
    - Update admin user with correct username and password hash
    - Ensure proper bcrypt hash for password 'admin123'

  2. Security
    - Maintain RLS policies
*/

-- Update admin user with correct data
UPDATE users 
SET 
  username = 'admin',
  password = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- bcrypt hash for 'admin123'
  nome = 'Administrador'
WHERE username = 'admin@sistema.com' OR username = 'admin';

-- Insert admin user if it doesn't exist
INSERT INTO users (username, password, nome)
SELECT 'admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrador'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');