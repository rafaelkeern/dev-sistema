/*
  # Create balancetes table

  1. New Tables
    - `balancetes`
      - `id` (integer, primary key, auto-increment)
      - `cliente_id` (integer, foreign key to clientes)
      - `periodo_inicio` (date)
      - `periodo_fim` (date)
      - `saldo_anterior` (numeric)
      - `debito` (numeric)
      - `credito` (numeric)
      - `saldo_atual` (numeric)
      - `codigo` (text)
      - `classificacao` (text)
      - `descricao_conta` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `balancetes` table
    - Add policies for authenticated users to manage balancetes
    - Add indexes for performance

  3. Foreign Keys
    - `cliente_id` references `clientes.id` with cascade delete
*/

CREATE TABLE IF NOT EXISTS balancetes (
  id serial PRIMARY KEY,
  cliente_id integer NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  saldo_anterior numeric DEFAULT 0,
  debito numeric DEFAULT 0,
  credito numeric DEFAULT 0,
  saldo_atual numeric DEFAULT 0,
  codigo text NOT NULL,
  classificacao text DEFAULT '',
  descricao_conta text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_balancetes_cliente_id ON balancetes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_balancetes_periodo ON balancetes(cliente_id, periodo_inicio, periodo_fim);
CREATE INDEX IF NOT EXISTS idx_balancetes_codigo ON balancetes(codigo);

ALTER TABLE balancetes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view balancetes"
  ON balancetes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert balancetes"
  ON balancetes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update balancetes"
  ON balancetes
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete balancetes"
  ON balancetes
  FOR DELETE
  TO authenticated
  USING (true);