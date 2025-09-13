/*
  # Seed initial data

  1. Create admin user
  2. Create sample clients
*/

-- Insert admin user (password: admin123 hashed with bcrypt)
INSERT INTO users (username, password, nome) 
VALUES ('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrador')
ON CONFLICT (username) DO NOTHING;

-- Insert sample clients
INSERT INTO clientes (nome, cnpj) VALUES 
  ('Empresa ABC Ltda', '11.222.333/0001-44'),
  ('Comércio XYZ S/A', '55.666.777/0001-88')
ON CONFLICT (cnpj) DO NOTHING;