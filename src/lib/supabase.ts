import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', {
    url: supabaseUrl ? 'OK' : 'MISSING',
    key: supabaseAnonKey ? 'OK' : 'MISSING'
  });
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: false
  }
});

// Types
export interface User {
  id: string;
  username: string;
  nome: string;
}

export interface Cliente {
  id: number;
  nome: string;
  cnpj: string;
  created_at: string;
  updated_at: string;
}

export interface Balancete {
  id: number;
  cliente_id: number;
  periodo_inicio: string;
  periodo_fim: string;
  saldo_anterior: number;
  debito: number;
  credito: number;
  saldo_atual: number;
  codigo: string;
  classificacao: string;
  descricao_conta: string;
  created_at: string;
  updated_at: string;
}