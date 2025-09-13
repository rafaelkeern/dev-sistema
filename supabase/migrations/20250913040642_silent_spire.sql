/*
  # Inserir usuário admin

  1. Inserir usuário admin com senha hasheada
    - username: admin
    - password: admin123 (hasheado com bcrypt)
    - nome: Administrador
*/

-- Primeiro, deletar qualquer usuário admin existente
DELETE FROM users WHERE username = 'admin';

-- Inserir o usuário admin com senha hasheada
INSERT INTO users (username, password, nome) VALUES (
  'admin',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'Administrador'
);