/*
  # Create clientes table

  1. New Tables
    - `clientes`
      - `id` (integer, primary key, auto-increment)
      - `nome` (text)
      - `cnpj` (text, unique)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `clientes` table
    - Add policies for authenticated users to manage clientes
*/

CREATE TABLE IF NOT EXISTS clientes (
  id serial PRIMARY KEY,
  nome text NOT NULL,
  cnpj text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view clientes"
  ON clientes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert clientes"
  ON clientes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update clientes"
  ON clientes
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete clientes"
  ON clientes
  FOR DELETE
  TO authenticated
  USING (true);