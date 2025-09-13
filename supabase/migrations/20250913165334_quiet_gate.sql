/*
  # Create DFC table

  1. New Tables
    - `dfc`
      - `id` (integer, primary key, auto-increment)
      - `cliente_id` (integer, foreign key to clientes)
      - `periodo_inicio` (date)
      - `periodo_fim` (date)
      - `titulo` (text)
      - `descricao` (text)
      - `valor` (numeric)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `dfc` table
    - Add policies for authenticated users to manage dfc
    - Add indexes for performance

  3. Foreign Keys
    - `cliente_id` references `clientes.id` with cascade delete
*/

CREATE TABLE IF NOT EXISTS dfc (
  id serial PRIMARY KEY,
  cliente_id integer NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  titulo text NOT NULL,
  descricao text NOT NULL,
  valor numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dfc_cliente_id ON dfc(cliente_id);
CREATE INDEX IF NOT EXISTS idx_dfc_periodo ON dfc(cliente_id, periodo_inicio, periodo_fim);
CREATE INDEX IF NOT EXISTS idx_dfc_titulo ON dfc(titulo);

ALTER TABLE dfc ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view dfc"
  ON dfc
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert dfc"
  ON dfc
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update dfc"
  ON dfc
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete dfc"
  ON dfc
  FOR DELETE
  TO authenticated
  USING (true);