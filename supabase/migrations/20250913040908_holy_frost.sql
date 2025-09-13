/*
  # Criar usuário admin simples

  1. New Tables
    - Remove usuário admin existente se houver
    - Insere novo usuário admin com senha simples
  
  2. Security
    - Mantém RLS habilitado
    - Políticas já existentes se aplicam
*/

-- Remove usuário admin existente
DELETE FROM users WHERE username = 'admin';

-- Insere usuário admin com senha simples
INSERT INTO users (username, password, nome) 
VALUES ('admin', 'admin123', 'Administrador');